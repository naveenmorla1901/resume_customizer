# app/schemas/resume.py
from pydantic import BaseModel
from typing import List, Optional
from app.models.resume import Resume, ResumeCreate, ResumeUpdate

# Re-export for convenience
__all__ = ['Resume', 'ResumeCreate', 'ResumeUpdate']