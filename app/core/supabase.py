# app/core/supabase.py
from supabase import create_client, Client
from app.config import get_settings
from functools import lru_cache

@lru_cache()
def get_supabase_client() -> Client:
    settings = get_settings()
    
    # Debug: Print settings to verify they're loaded correctly
    print(f"Supabase URL: {settings.supabase_url[:20]}...")
    print(f"Supabase Key: {settings.supabase_anon_key[:20]}...")
    
    try:
        # Simple client creation - exactly like the working test script
        supabase = create_client(
            settings.supabase_url,
            settings.supabase_anon_key
        )
        print("✅ Supabase client created successfully")
        return supabase
    except Exception as e:
        print(f"❌ Supabase client creation failed: {e}")
        print(f"URL: {settings.supabase_url}")
        print(f"Key length: {len(settings.supabase_anon_key) if settings.supabase_anon_key else 'None'}")
        raise

def get_admin_supabase_client() -> Client:
    """For admin operations that require service key"""
    settings = get_settings()
    try:
        # Simple client creation for admin too
        supabase = create_client(
            settings.supabase_url,
            settings.supabase_service_key
        )
        return supabase
    except Exception as e:
        print(f"Admin Supabase client creation failed: {e}")
        raise