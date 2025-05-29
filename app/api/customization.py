# app/api/customization.py - Updated with multi-provider AI support and better PDF handling
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import FileResponse
from supabase import Client
import logging
from app.core.supabase import get_supabase_client
from app.core.ai_service import ai_service
from app.core.pdf_generator import pdf_generator, PDF_GENERATION_METHOD
from app.dependencies import get_current_user
from app.schemas.customization import CustomizationRequest, CustomizationResponse, AIProvidersResponse
from app.models.resume import ResumeType
from app.utils.validation import validate_latex_content
import uuid
import asyncio

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/providers", response_model=AIProvidersResponse)
async def get_available_providers():
    """Get list of available AI providers"""
    try:
        available_providers = ai_service.get_available_providers()
        
        # Determine default provider (prefer Claude, then Gemini, then DeepSeek)
        default_provider = "claude"
        if "claude" not in available_providers:
            if "gemini" in available_providers:
                default_provider = "gemini"
            elif "deepseek" in available_providers:
                default_provider = "deepseek"
            else:
                default_provider = list(available_providers.keys())[0] if available_providers else None
        
        if not available_providers:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No AI providers are configured. Please check your API keys."
            )
        
        return AIProvidersResponse(
            available_providers=available_providers,
            default_provider=default_provider
        )
        
    except Exception as e:
        logger.error(f"Failed to get AI providers: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get AI providers: {str(e)}"
        )

@router.post("/", response_model=CustomizationResponse)
async def customize_resume(
    customization_request: CustomizationRequest,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Customize a resume using selected AI provider based on job description"""
    try:
        logger.info(f"Starting resume customization for user: {current_user.id}")
        logger.info(f"Resume ID: {customization_request.resume_id}")
        logger.info(f"AI Provider: {customization_request.ai_provider}")
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
        
        # Use AI service to customize the resume
        try:
            logger.info(f"Starting AI customization with {customization_request.ai_provider}...")
            customized_latex = await ai_service.customize_resume(
                provider_id=customization_request.ai_provider,
                latex_content=original_resume["latex_content"],
                job_description=customization_request.job_description,
                sections_to_modify=customization_request.sections_to_modify,
                modification_percentage=customization_request.modification_percentage
            )
            logger.info(f"AI customization completed. Output length: {len(customized_latex)} characters")
            
        except Exception as ai_error:
            logger.error(f"AI customization failed: {str(ai_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Resume customization failed: {str(ai_error)}"
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
            old_name = temp_resume_response.data[0]["name"]
            logger.info(f"✅ REPLACING existing temp resume '{old_name}' (ID: {temp_resume_id}) with new customization")
            supabase.table("resumes").update({
                "name": temp_resume_name,
                "latex_content": customized_latex
            }).eq("id", temp_resume_id).execute()
            logger.info(f"✅ Temp resume replaced successfully - old content discarded, new customization saved")
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
        
        # Generate PDF preview with retry logic
        pdf_url = None
        try:
            logger.info(f"Starting PDF generation using {PDF_GENERATION_METHOD} method")
            
            # Add a small delay to ensure database is updated
            await asyncio.sleep(0.5)
            
            pdf_path = await pdf_generator.latex_to_pdf(
                customized_latex, 
                f"customized_{temp_resume_id[:8]}"
            )
            
            # PDF preview URL
            pdf_url = f"/api/customize/preview/{temp_resume_id}"
            logger.info(f"PDF generated successfully, preview URL: {pdf_url}")
                
        except Exception as pdf_error:
            # PDF generation failed, but we can still return the LaTeX
            logger.warning(f"PDF generation failed (continuing without PDF): {str(pdf_error)}")
        
        logger.info("Resume customization completed successfully")
        return CustomizationResponse(
            updated_latex=customized_latex,
            temp_resume_id=temp_resume_id,
            pdf_url=pdf_url,
            ai_provider_used=customization_request.ai_provider
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
    """Get PDF preview of customized resume with retry logic"""
    try:
        logger.info(f"Generating preview for temp resume {temp_resume_id}, user: {current_user.id}")
        
        # Add retry logic for database consistency
        max_retries = 3
        retry_delay = 1  # seconds
        
        resume = None
        for attempt in range(max_retries):
            # Get the temporary resume
            response = supabase.table("resumes").select("*").eq(
                "id", temp_resume_id
            ).eq("user_id", current_user.id).eq(
                "resume_type", ResumeType.TEMPORARY.value
            ).execute()
            
            if response.data:
                resume = response.data[0]
                break
            elif attempt < max_retries - 1:
                logger.info(f"Temp resume not found, retry {attempt + 1}/{max_retries}")
                await asyncio.sleep(retry_delay)
            else:
                logger.warning(f"Temp resume {temp_resume_id} not found after {max_retries} attempts")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Customized resume not found"
                )
        
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
