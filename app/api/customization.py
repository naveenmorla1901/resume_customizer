# app/api/customization.py - With enhanced error handling and debugging
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import FileResponse
from supabase import Client
import logging
from app.core.supabase import get_supabase_client
from app.core.claude import claude_service
from app.core.pdf_generator import pdf_generator, PDF_GENERATION_METHOD
from app.dependencies import get_current_user
from app.schemas.customization import CustomizationRequest, CustomizationResponse
from app.models.resume import ResumeType
from app.utils.validation import validate_latex_content
import uuid

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/", response_model=CustomizationResponse)
async def customize_resume(
    customization_request: CustomizationRequest,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Customize a resume using Claude API based on job description"""
    try:
        logger.info(f"Starting resume customization for user: {current_user.id}")
        logger.info(f"Resume ID: {customization_request.resume_id}")
        logger.info(f"Sections to modify: {customization_request.sections_to_modify}")
        logger.info(f"Modification percentage: {customization_request.modification_percentage}%")
        
        # Get the original resume
        resume_response = supabase.table("resumes").select("*").eq(
            "id", customization_request.resume_id
        ).eq("user_id", current_user.id).execute()
        
        if not resume_response.data:
            logger.warning(f"Resume {customization_request.resume_id} not found for user {current_user.id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume not found"
            )
        
        original_resume = resume_response.data[0]
        logger.info(f"Found original resume: {original_resume['name']}")
        
        # Use Claude API to customize the resume
        try:
            logger.info("Starting Claude API customization...")
            customized_latex = await claude_service.customize_resume(
                latex_content=original_resume["latex_content"],
                job_description=customization_request.job_description,
                sections_to_modify=customization_request.sections_to_modify,
                modification_percentage=customization_request.modification_percentage
            )
            logger.info(f"Claude API customization completed. Output length: {len(customized_latex)} characters")
            
        except Exception as claude_error:
            logger.error(f"Claude API customization failed: {str(claude_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Resume customization failed: {str(claude_error)}"
            )
        
        # Validate the generated LaTeX
        if not validate_latex_content(customized_latex):
            logger.error("Generated LaTeX content failed validation")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Generated LaTeX content is invalid"
            )
        
        logger.info("Generated LaTeX content passed validation")
        
        # Save as temporary resume (overwrite existing temp resume if any)
        temp_resume_name = f"{original_resume['name']} (Customized)"
        
        # Check if a temp resume already exists for this user
        temp_resume_response = supabase.table("resumes").select("*").eq(
            "user_id", current_user.id
        ).eq("resume_type", ResumeType.TEMPORARY.value).execute()
        
        if temp_resume_response.data:
            # Update existing temp resume
            temp_resume_id = temp_resume_response.data[0]["id"]
            logger.info(f"Updating existing temp resume: {temp_resume_id}")
            supabase.table("resumes").update({
                "name": temp_resume_name,
                "latex_content": customized_latex
            }).eq("id", temp_resume_id).execute()
        else:
            # Create new temp resume
            logger.info("Creating new temp resume")
            temp_resume_data = {
                "user_id": current_user.id,
                "name": temp_resume_name,
                "latex_content": customized_latex,
                "resume_type": ResumeType.TEMPORARY.value
            }
            
            temp_response = supabase.table("resumes").insert(temp_resume_data).execute()
            temp_resume_id = temp_response.data[0]["id"]
        
        logger.info(f"Temp resume saved with ID: {temp_resume_id}")
        
        # Generate PDF preview
        pdf_url = None
        try:
            logger.info(f"Starting PDF generation using {PDF_GENERATION_METHOD} method")
            pdf_path = await pdf_generator.latex_to_pdf(
                customized_latex, 
                f"customized_{temp_resume_id[:8]}"
            )
            
            # Since we're generating a preview PDF, we return the preview endpoint URL
            pdf_url = f"/api/customize/preview/{temp_resume_id}"
            logger.info(f"PDF generated successfully, preview URL: {pdf_url}")
                
        except Exception as pdf_error:
            # PDF generation failed, but we can still return the LaTeX
            logger.warning(f"PDF generation failed (continuing without PDF): {str(pdf_error)}")
        
        logger.info("Resume customization completed successfully")
        return CustomizationResponse(
            updated_latex=customized_latex,
            temp_resume_id=temp_resume_id,
            pdf_url=pdf_url
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in customize_resume: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Customization failed: {str(e)}"
        )

@router.get("/preview/{temp_resume_id}")
async def get_customized_resume_preview(
    temp_resume_id: str,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Get PDF preview of customized resume"""
    try:
        logger.info(f"Generating preview for temp resume {temp_resume_id}, user: {current_user.id}")
        
        # Get the temporary resume
        response = supabase.table("resumes").select("*").eq(
            "id", temp_resume_id
        ).eq("user_id", current_user.id).eq(
            "resume_type", ResumeType.TEMPORARY.value
        ).execute()
        
        if not response.data:
            logger.warning(f"Temp resume {temp_resume_id} not found for user {current_user.id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customized resume not found"
            )
        
        resume = response.data[0]
        logger.info(f"Found temp resume: {resume['name']}")
        
        # Generate PDF using the unified interface
        try:
            logger.info(f"Starting PDF generation for preview using {PDF_GENERATION_METHOD} method")
            
            pdf_path = await pdf_generator.latex_to_pdf(
                resume["latex_content"], 
                f"preview_{temp_resume_id[:8]}"
            )
            
            logger.info(f"Preview PDF generated successfully: {pdf_path}")
            
            # Schedule cleanup of temp file in background
            background_tasks.add_task(pdf_generator.cleanup_temp_file, pdf_path)
            
            return FileResponse(
                pdf_path,
                media_type="application/pdf",
                filename=f"{resume['name']}_preview.pdf"
            )
            
        except Exception as pdf_error:
            logger.error(f"Preview PDF generation failed for temp resume {temp_resume_id}: {str(pdf_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate preview: {str(pdf_error)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_customized_resume_preview for {temp_resume_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate preview: {str(e)}"
        )

@router.post("/save-customized/{temp_resume_id}")
async def save_customized_resume(
    temp_resume_id: str,
    current_user = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Save the temporary customized resume as a permanent resume"""
    try:
        logger.info(f"Saving temp resume {temp_resume_id} as permanent for user: {current_user.id}")
        
        # Get the temporary resume
        response = supabase.table("resumes").select("*").eq(
            "id", temp_resume_id
        ).eq("user_id", current_user.id).eq(
            "resume_type", ResumeType.TEMPORARY.value
        ).execute()
        
        if not response.data:
            logger.warning(f"Temp resume {temp_resume_id} not found for user {current_user.id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customized resume not found"
            )
        
        temp_resume = response.data[0]
        
        # Create a new permanent resume
        permanent_resume_data = {
            "user_id": current_user.id,
            "name": temp_resume["name"].replace(" (Customized)", f" - Saved {uuid.uuid4().hex[:4]}"),
            "latex_content": temp_resume["latex_content"],
            "resume_type": ResumeType.ORIGINAL.value
        }
        
        permanent_response = supabase.table("resumes").insert(permanent_resume_data).execute()
        
        logger.info(f"Customized resume saved permanently with ID: {permanent_response.data[0]['id']}")
        
        return {
            "message": "Customized resume saved successfully",
            "resume_id": permanent_response.data[0]["id"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save customized resume {temp_resume_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save customized resume: {str(e)}"
        )
