# app/schemas/customization.py - Updated with AI provider selection
from pydantic import BaseModel, Field
from typing import List, Optional
from app.models.resume import ResumeSections

class CustomizationRequest(BaseModel):
    resume_id: str
    job_description: str
    sections_to_modify: List[ResumeSections]
    modification_percentage: int = Field(ge=1, le=100, description="Percentage of changes (1-100)")
    ai_provider: str = Field(default="claude", description="AI provider to use (claude, gemini, deepseek)")

class CustomizationResponse(BaseModel):
    updated_latex: str
    temp_resume_id: str
    pdf_url: Optional[str] = None
    ai_provider_used: str

class AIProvidersResponse(BaseModel):
    available_providers: dict
    default_provider: str
