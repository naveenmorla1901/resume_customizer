# app/api/resumes.py - With enhanced error handling and debugging
from fastapi import APIRouter, Depends, HTTPException, status, Response, BackgroundTasks
from fastapi.responses import FileResponse
from supabase import Client
from typing import List
import logging
from app.core.supabase import get_supabase_client
from app.core.pdf_generator import pdf_generator, PDF_GENERATION_METHOD
from app.dependencies import get_current_user
from app.models.resume import Resume, ResumeCreate, ResumeUpdate, ResumeType
from app.utils.validation import validate_latex_content

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/", response_model=List[Resume])
async def get_user_resumes(
    current_user = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Get all resumes for the current user"""
    try:
        logger.info(f"Fetching resumes for user: {current_user.id}")
        response = supabase.table("resumes").select("*").eq("user_id", current_user.id).execute()
        logger.info(f"Found {len(response.data)} resumes")
        return response.data
    except Exception as e:
        logger.error(f"Failed to fetch resumes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch resumes: {str(e)}"
        )

@router.get("/{resume_id}", response_model=Resume)
async def get_resume(
    resume_id: str,
    current_user = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Get a specific resume by ID"""
    try:
        logger.info(f"Fetching resume {resume_id} for user: {current_user.id}")
        response = supabase.table("resumes").select("*").eq("id", resume_id).eq("user_id", current_user.id).execute()
        
        if not response.data:
            logger.warning(f"Resume {resume_id} not found for user {current_user.id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume not found"
            )
        
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch resume {resume_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch resume: {str(e)}"
        )

@router.post("/", response_model=Resume)
async def create_resume(
    resume_data: ResumeCreate,
    current_user = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Create a new resume"""
    try:
        logger.info(f"Creating resume '{resume_data.name}' for user: {current_user.id}")
        
        # Validate LaTeX content
        if not validate_latex_content(resume_data.latex_content):
            logger.warning(f"Invalid LaTeX content for resume '{resume_data.name}'")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid LaTeX content"
            )
        
        # Insert resume into database
        resume_dict = {
            "user_id": current_user.id,
            "name": resume_data.name,
            "latex_content": resume_data.latex_content,
            "resume_type": ResumeType.ORIGINAL.value
        }
        
        response = supabase.table("resumes").insert(resume_dict).execute()
        
        if not response.data:
            logger.error(f"Failed to create resume '{resume_data.name}' in database")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create resume"
            )
        
        logger.info(f"Resume '{resume_data.name}' created successfully with ID: {response.data[0]['id']}")
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create resume '{resume_data.name}': {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create resume: {str(e)}"
        )

@router.put("/{resume_id}", response_model=Resume)
async def update_resume(
    resume_id: str,
    resume_data: ResumeUpdate,
    current_user = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Update an existing resume"""
    try:
        logger.info(f"Updating resume {resume_id} for user: {current_user.id}")
        
        # Check if resume exists and belongs to user
        existing = supabase.table("resumes").select("*").eq("id", resume_id).eq("user_id", current_user.id).execute()
        
        if not existing.data:
            logger.warning(f"Resume {resume_id} not found for user {current_user.id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume not found"
            )
        
        # Validate LaTeX content if provided
        update_data = {}
        if resume_data.name is not None:
            update_data["name"] = resume_data.name
        
        if resume_data.latex_content is not None:
            if not validate_latex_content(resume_data.latex_content):
                logger.warning(f"Invalid LaTeX content for resume {resume_id}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid LaTeX content"
                )
            update_data["latex_content"] = resume_data.latex_content
        
        # Update resume
        response = supabase.table("resumes").update(update_data).eq("id", resume_id).execute()
        
        logger.info(f"Resume {resume_id} updated successfully")
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update resume {resume_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update resume: {str(e)}"
        )

@router.delete("/{resume_id}")
async def delete_resume(
    resume_id: str,
    current_user = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Delete a resume"""
    try:
        logger.info(f"Deleting resume {resume_id} for user: {current_user.id}")
        
        # Check if resume exists and belongs to user
        existing = supabase.table("resumes").select("*").eq("id", resume_id).eq("user_id", current_user.id).execute()
        
        if not existing.data:
            logger.warning(f"Resume {resume_id} not found for user {current_user.id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume not found"
            )
        
        # Delete resume
        supabase.table("resumes").delete().eq("id", resume_id).execute()
        
        logger.info(f"Resume {resume_id} deleted successfully")
        return {"message": "Resume deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete resume {resume_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete resume: {str(e)}"
        )

@router.get("/{resume_id}/pdf")
async def get_resume_pdf(
    resume_id: str,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Generate and download PDF for a resume"""
    try:
        logger.info(f"Generating PDF for resume {resume_id}, user: {current_user.id}")
        
        # Get resume
        response = supabase.table("resumes").select("*").eq("id", resume_id).eq("user_id", current_user.id).execute()
        
        if not response.data:
            logger.warning(f"Resume {resume_id} not found for user {current_user.id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume not found"
            )
        
        resume = response.data[0]
        logger.info(f"Found resume: {resume['name']}")
        
        # Generate PDF using the unified interface
        try:
            logger.info(f"Starting PDF generation using {PDF_GENERATION_METHOD} method")
            
            pdf_path = await pdf_generator.latex_to_pdf(
                resume["latex_content"], 
                f"{resume['name']}_{resume_id[:8]}"
            )
            
            logger.info(f"PDF generated successfully: {pdf_path}")
            
            # Schedule cleanup of temp file in background
            background_tasks.add_task(pdf_generator.cleanup_temp_file, pdf_path)
            
            return FileResponse(
                pdf_path,
                media_type="application/pdf",
                filename=f"{resume['name']}.pdf",
                headers={"Content-Disposition": f"attachment; filename={resume['name']}.pdf"}
            )
            
        except Exception as pdf_error:
            logger.error(f"PDF generation failed for resume {resume_id}: {str(pdf_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate PDF: {str(pdf_error)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_resume_pdf for {resume_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate PDF: {str(e)}"
        )
