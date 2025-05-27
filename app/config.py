# app/config.py - Updated with multiple AI provider support
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List, Optional

class Settings(BaseSettings):
    # Supabase Configuration
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str
    
    # AI API Configuration
    claude_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    deepseek_api_key: Optional[str] = None
    
    # Application Settings
    app_name: str = "Resume Customizer"
    debug: bool = False
    allowed_origins: str = "http://localhost:3000,http://localhost:8000,http://127.0.0.1:8000"
    
    # File Storage
    temp_file_directory: str = "temp_files"
    max_file_size: int = 10 * 1024 * 1024  # 10MB
    
    class Config:
        env_file = ".env"
    
    def get_allowed_origins(self) -> List[str]:
        """Parse the allowed origins string into a list"""
        return [origin.strip() for origin in self.allowed_origins.split(",")]

@lru_cache()
def get_settings():
    return Settings()
