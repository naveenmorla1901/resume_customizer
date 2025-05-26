# app/models/resume.py
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class ResumeType(str, Enum):
    ORIGINAL = "original"
    TEMPORARY = "temporary"

class ResumeSections(str, Enum):
    EXPERIENCE = "experience"
    PROJECTS = "projects"
    SKILLS = "skills"
    EDUCATION = "education"
    CERTIFICATIONS = "certifications"

class Resume(BaseModel):
    id: Optional[str] = None
    user_id: str
    name: str
    latex_content: str
    resume_type: ResumeType = ResumeType.ORIGINAL
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ResumeCreate(BaseModel):
    name: str
    latex_content: str

class ResumeUpdate(BaseModel):
    name: Optional[str] = None
    latex_content: Optional[str] = None
