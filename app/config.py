# app/config.py
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
