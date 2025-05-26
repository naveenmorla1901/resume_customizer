#!/usr/bin/env python3
"""
Auto setup script for Resume Customizer project
Run this script to create all missing files and directories
"""

import os
from pathlib import Path

def create_file(filepath, content):
    """Create a file with the given content"""
    Path(filepath).parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ Created {filepath}")

def create_empty_file(filepath):
    """Create an empty file"""
    create_file(filepath, "")

# Create directories
os.makedirs("temp_files", exist_ok=True)
print("✅ Created temp_files/ directory")

# Create all __init__.py files (empty)
init_files = [
    "app/__init__.py",
    "app/api/__init__.py", 
    "app/core/__init__.py",
    "app/models/__init__.py",
    "app/schemas/__init__.py",
    "app/utils/__init__.py"
]

for file in init_files:
    create_empty_file(file)

# Create app/config.py
config_content = '''# app/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Supabase Configuration
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str
    
    # Claude API Configuration
    claude_api_key: str
    
    # Application Settings
    app_name: str = "Resume Customizer"
    debug: bool = False
    allowed_origins: list = ["http://localhost:3000"]
    
    # File Storage
    temp_file_directory: str = "temp_files"
    max_file_size: int = 10 * 1024 * 1024  # 10MB
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
'''

create_file("app/config.py", config_content)

# Create app/dependencies.py
dependencies_content = '''# app/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import Client
from app.core.supabase import get_supabase_client

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    supabase: Client = Depends(get_supabase_client)
):
    """Verify JWT token and get current user from Supabase"""
    try:
        # Verify token with Supabase
        user_response = supabase.auth.get_user(credentials.credentials)
        if user_response.user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        return user_response.user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
'''

create_file("app/dependencies.py", dependencies_content)

# Create app/models/resume.py
resume_model_content = '''# app/models/resume.py
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
'''

create_file("app/models/resume.py", resume_model_content)

# Create app/models/user.py
user_model_content = '''# app/models/user.py
from pydantic import BaseModel, EmailStr
from typing import Optional

class User(BaseModel):
    id: str
    email: EmailStr
    full_name: Optional[str] = None
    created_at: Optional[str] = None
'''

create_file("app/models/user.py", user_model_content)

# Create app/schemas/auth.py
auth_schema_content = '''# app/schemas/auth.py
from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
'''

create_file("app/schemas/auth.py", auth_schema_content)

# Create app/schemas/customization.py
customization_schema_content = '''# app/schemas/customization.py
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
'''

create_file("app/schemas/customization.py", customization_schema_content)

# Create app/utils/validation.py
validation_content = '''# app/utils/validation.py
import re
from typing import List

def validate_latex_content(latex_content: str) -> bool:
    """
    Validate basic LaTeX document structure
    """
    if not latex_content or not isinstance(latex_content, str):
        return False
    
    # Check for basic LaTeX document structure
    required_elements = [
        r'\\\\documentclass',
        r'\\\\begin{document}',
        r'\\\\end{document}'
    ]
    
    for element in required_elements:
        if not re.search(element, latex_content):
            return False
    
    # Check for balanced braces (basic check)
    open_braces = latex_content.count('{')
    close_braces = latex_content.count('}')
    
    if open_braces != close_braces:
        return False
    
    # Check for common LaTeX errors
    error_patterns = [
        r'\\\\end{document}.*\\\\begin{document}',  # document blocks in wrong order
        r'\\\\documentclass.*\\\\documentclass',     # multiple documentclass declarations
    ]
    
    for pattern in error_patterns:
        if re.search(pattern, latex_content):
            return False
    
    return True

def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename for safe file operations
    """
    # Remove or replace unsafe characters
    unsafe_chars = ['<', '>', ':', '"', '/', '\\\\', '|', '?', '*']
    for char in unsafe_chars:
        filename = filename.replace(char, '_')
    
    # Remove leading/trailing spaces and dots
    filename = filename.strip('. ')
    
    # Ensure filename is not empty
    if not filename:
        filename = "untitled"
    
    return filename
'''

create_file("app/utils/validation.py", validation_content)

# Create app/utils/file_handler.py
file_handler_content = '''# app/utils/file_handler.py
import os
import shutil
from pathlib import Path
from typing import Optional
from app.utils.validation import sanitize_filename

class FileHandler:
    """Handle file operations for the application"""
    
    def __init__(self, base_dir: str = "temp_files"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(exist_ok=True)
    
    def save_temp_file(self, content: str, filename: str, extension: str = ".tex") -> str:
        """Save content to a temporary file"""
        safe_filename = sanitize_filename(filename)
        file_path = self.base_dir / f"{safe_filename}{extension}"
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return str(file_path)
    
    def read_file(self, file_path: str) -> str:
        """Read content from a file"""
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def delete_file(self, file_path: str) -> bool:
        """Delete a file"""
        try:
            os.remove(file_path)
            return True
        except (OSError, FileNotFoundError):
            return False
    
    def cleanup_old_files(self, max_age_hours: int = 24):
        """Clean up files older than specified hours"""
        import time
        current_time = time.time()
        cutoff_time = current_time - (max_age_hours * 3600)
        
        for file_path in self.base_dir.glob("*"):
            if file_path.is_file():
                file_age = os.path.getmtime(file_path)
                if file_age < cutoff_time:
                    try:
                        os.remove(file_path)
                    except OSError:
                        pass  # Ignore errors when deleting

# Create global file handler instance
file_handler = FileHandler()
'''

create_file("app/utils/file_handler.py", file_handler_content)

print("\n🎉 All files created successfully!")
print("\nNext steps:")
print("1. Make sure your .env file has the correct Supabase and Claude API keys")
print("2. Run: pip install -r requirements.txt")
print("3. Run: uvicorn app.main:app --reload --port 8000")
print("4. Test: curl http://localhost:8000/health")