# app/api/resumes.py
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import FileResponse
from supabase import Client
from typing import List
from app.core.supabase import get_supabase_client
from app.core.pdf_generator import pdf_generator, PDF_GENERATION_METHOD
from app.dependencies import get_current_user
from app.models.resume import Resume, ResumeCreate, ResumeUpdate, ResumeType
from app.utils.validation import validate_latex_content

router = APIRouter()

@router.get("/", response_model=List[Resume])
async def get_user_resumes(
    current_user = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Get all resumes for the current user"""
    try:
        response = supabase.table("resumes").select("*").eq("user_id", current_user.id).execute()
        return response.data
    except Exception as e:
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
        response = supabase.table("resumes").select("*").eq("id", resume_id).eq("user_id", current_user.id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume not found"
            )
        
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
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
        # Validate LaTeX content
        if not validate_latex_content(resume_data.latex_content):
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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create resume"
            )
        
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
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
        # Check if resume exists and belongs to user
        existing = supabase.table("resumes").select("*").eq("id", resume_id).eq("user_id", current_user.id).execute()
        
        if not existing.data:
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
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid LaTeX content"
                )
            update_data["latex_content"] = resume_data.latex_content
        
        # Update resume
        response = supabase.table("resumes").update(update_data).eq("id", resume_id).execute()
        
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
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
        # Check if resume exists and belongs to user
        existing = supabase.table("resumes").select("*").eq("id", resume_id).eq("user_id", current_user.id).execute()
        
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume not found"
            )
        
        # Delete resume
        supabase.table("resumes").delete().eq("id", resume_id).execute()
        
        return {"message": "Resume deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete resume: {str(e)}"
        )

@router.get("/{resume_id}/pdf")
async def get_resume_pdf(
    resume_id: str,
    current_user = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """Generate and download PDF for a resume"""
    try:
        # Get resume
        response = supabase.table("resumes").select("*").eq("id", resume_id).eq("user_id", current_user.id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resume not found"
            )
        
        resume = response.data[0]
        
        # Generate PDF
        if PDF_GENERATION_METHOD == "local":
            pdf_path, temp_dir = pdf_generator.latex_to_pdf(
                resume["latex_content"], 
                f"{resume['name']}_{resume_id[:8]}"
            )
            
            return FileResponse(
                pdf_path,
                media_type="application/pdf",
                filename=f"{resume['name']}.pdf",
                headers={"Content-Disposition": f"attachment; filename={resume['name']}.pdf"}
            )
        else:
            # For online PDF generation, return a download URL
            pdf_path = await pdf_generator.latex_to_pdf_online(resume["latex_content"])
            return FileResponse(
                pdf_path,
                media_type="application/pdf",
                filename=f"{resume['name']}.pdf"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate PDF: {str(e)}"
        )