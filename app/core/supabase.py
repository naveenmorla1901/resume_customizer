# app/core/supabase.py
from supabase import create_client, Client
from app.config import get_settings
from functools import lru_cache

@lru_cache()
def get_supabase_client() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_anon_key)

def get_admin_supabase_client() -> Client:
    """For admin operations that require service key"""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_key)