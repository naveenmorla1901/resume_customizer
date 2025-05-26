# app/schemas/customization.py
from pydantic import BaseModel, Field
from typing import List, Optional
from app.models.resume import ResumeSections

class CustomizationRequest(BaseModel):
    resume_id: str
    job_description: str
    sections_to_modify: List[ResumeSections]
    modification_percentage: int = Field(ge=1, le=100, description="Percentage of changes (1-100)")

class CustomizationResponse(BaseModel):
    updated_latex: str
    temp_resume_id: str
    pdf_url: Optional[str] = None
