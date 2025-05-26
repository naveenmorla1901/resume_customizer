# app/api/customization.py
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import FileResponse
from supabase import Client
from app.core.supabase import get_supabase_client
from app.core.claude import claude_service
from app.core.pdf_generator import pdf_generator, PDF_GENERATION_METHOD
from app.dependencies import get_current_user
from app.schemas.customization import CustomizationRequest, CustomizationResponse
from app.models.resume import ResumeType
from app.utils.validation import validate_latex_content
import uuid

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
        # Get the original resume
        resume_response = supabase.table("resumes").select("*").eq(
            "id", customization_request.resume_id
        ).eq("user_id", current_user.id).execute()
        
        if not resume_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume not found"
            )
        
        original_resume = resume_response.data[0]
        
        # Use Claude API to customize the resume
        try:
            customized_latex = await claude_service.customize_resume(
                latex_content=original_resume["latex_content"],
                job_description=customization_request.job_description,
                sections_to_modify=customization_request.sections_to_modify,
                modification_percentage=customization_request.modification_percentage
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Resume customization failed: {str(e)}"
            )
        
        # Validate the generated LaTeX
        if not validate_latex_content(customized_latex):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Generated LaTeX content is invalid"
            )
        
        # Save as temporary resume (overwrite existing temp resume if any)
        temp_resume_name = f"{original_resume['name']} (Customized)"
        
        # Check if a temp resume already exists for this user
        temp_resume_response = supabase.table("resumes").select("*").eq(
            "user_id", current_user.id
        ).eq("resume_type", ResumeType.TEMPORARY.value).execute()
        
        if temp_resume_response.data:
            # Update existing temp resume
            temp_resume_id = temp_resume_response.data[0]["id"]
            supabase.table("resumes").update({
                "name": temp_resume_name,
                "latex_content": customized_latex
            }).eq("id", temp_resume_id).execute()
        else:
            # Create new temp resume
            temp_resume_data = {
                "user_id": current_user.id,
                "name": temp_resume_name,
                "latex_content": customized_latex,
                "resume_type": ResumeType.TEMPORARY.value
            }
            
            temp_response = supabase.table("resumes").insert(temp_resume_data).execute()
            temp_resume_id = temp_response.data[0]["id"]
        
        # Generate PDF preview
        pdf_url = None
        try:
            pdf_path = await pdf_generator.latex_to_pdf(
                customized_latex, 
                f"customized_{temp_resume_id[:8]}"
            )
            
            # Since we're generating a preview PDF, we could expose it through a static endpoint
            # For now, we'll return the preview endpoint URL
            pdf_url = f"/api/customize/preview/{temp_resume_id}"
            
            # Schedule cleanup of temp files in background (after some delay to allow preview)
            # background_tasks.add_task(pdf_generator.cleanup_temp_file, pdf_path)
                
        except Exception as e:
            # PDF generation failed, but we can still return the LaTeX
            print(f"PDF generation failed: {e}")
        
        return CustomizationResponse(
            updated_latex=customized_latex,
            temp_resume_id=temp_resume_id,
            pdf_url=pdf_url
        )
        
    except HTTPException:
        raise
    except Exception as e:
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
        # Get the temporary resume
        response = supabase.table("resumes").select("*").eq(
            "id", temp_resume_id
        ).eq("user_id", current_user.id).eq(
            "resume_type", ResumeType.TEMPORARY.value
        ).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customized resume not found"
            )
        
        resume = response.data[0]
        
        # Generate PDF using the unified interface
        try:
            pdf_path = await pdf_generator.latex_to_pdf(
                resume["latex_content"], 
                f"preview_{temp_resume_id[:8]}"
            )
            
            # Schedule cleanup of temp file in background
            background_tasks.add_task(pdf_generator.cleanup_temp_file, pdf_path)
            
            return FileResponse(
                pdf_path,
                media_type="application/pdf",
                filename=f"{resume['name']}_preview.pdf"
            )
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate preview: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
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
        # Get the temporary resume
        response = supabase.table("resumes").select("*").eq(
            "id", temp_resume_id
        ).eq("user_id", current_user.id).eq(
            "resume_type", ResumeType.TEMPORARY.value
        ).execute()
        
        if not response.data:
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
        
        return {
            "message": "Customized resume saved successfully",
            "resume_id": permanent_response.data[0]["id"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save customized resume: {str(e)}"
        )
