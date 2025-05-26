# test_supabase.py - Test Supabase connection
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

print("Testing Supabase Connection...")
print(f"SUPABASE_URL: {os.getenv('SUPABASE_URL')}")
print(f"SUPABASE_ANON_KEY: {os.getenv('SUPABASE_ANON_KEY')[:20]}...")

try:
    from supabase import create_client
    
    supabase = create_client(
        os.getenv('SUPABASE_URL'),
        os.getenv('SUPABASE_ANON_KEY')
    )
    
    print("✅ Supabase client created successfully!")
    
    # Test auth
    print("Testing auth...")
    print(f"Auth client: {supabase.auth}")
    
    # Test database connection
    print("Testing database connection...")
    response = supabase.table('resumes').select('*').limit(1).execute()
    print(f"✅ Database connection successful!")
    print(f"Response: {response}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    print(f"Error type: {type(e)}")
    import traceback
    traceback.print_exc()