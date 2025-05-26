#!/usr/bin/env python3
"""
Quick dependency installer and environment checker
"""

import subprocess
import sys
import os
from pathlib import Path

def install_dependencies():
    """Install required dependencies"""
    print("🔧 Installing required dependencies...")
    
    # Core dependencies needed for PDF generation
    core_deps = [
        "aiohttp>=3.9.1",
        "aiofiles>=23.2.1", 
        "reportlab>=4.0.4",
        "fastapi>=0.104.1",
        "uvicorn[standard]>=0.24.0",
        "supabase>=2.1.0",
        "anthropic>=0.7.8"
    ]
    
    for dep in core_deps:
        try:
            print(f"Installing {dep}...")
            result = subprocess.run([
                sys.executable, "-m", "pip", "install", dep
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                print(f"✅ {dep} installed successfully")
            else:
                print(f"❌ Failed to install {dep}: {result.stderr}")
                
        except Exception as e:
            print(f"❌ Error installing {dep}: {e}")

def check_environment():
    """Check environment setup"""
    print("\n🔍 Checking environment setup...")
    
    # Check if .env file exists
    env_file = Path(".env")
    if env_file.exists():
        print("✅ .env file found")
        
        # Check for key variables
        with open(env_file, 'r') as f:
            content = f.read()
            
        required_vars = [
            "SUPABASE_URL",
            "SUPABASE_ANON_KEY", 
            "CLAUDE_API_KEY"
        ]
        
        missing_vars = []
        for var in required_vars:
            if var not in content or f"{var}=" not in content:
                missing_vars.append(var)
        
        if missing_vars:
            print(f"⚠️  Missing environment variables: {missing_vars}")
        else:
            print("✅ Required environment variables present")
            
    else:
        print("❌ .env file not found")
        print("   Create .env file with required variables:")
        print("   SUPABASE_URL=your_supabase_url")
        print("   SUPABASE_ANON_KEY=your_supabase_anon_key")
        print("   CLAUDE_API_KEY=your_claude_api_key")
    
    # Check temp directory
    temp_dir = Path("temp_files")
    if not temp_dir.exists():
        print("⚠️  Creating temp_files directory...")
        temp_dir.mkdir(exist_ok=True)
        print("✅ temp_files directory created")
    else:
        print("✅ temp_files directory exists")

def main():
    print("🚀 Resume Customizer - Quick Setup")
    print("=" * 40)
    
    install_dependencies()
    check_environment()
    
    print("\n" + "=" * 40)
    print("✅ Setup complete!")
    print("\n📝 Next steps:")
    print("1. Configure your .env file with API keys")
    print("2. Run tests: python test_fixes.py")
    print("3. Start server: uvicorn app.main:app --reload --port 8000")

if __name__ == "__main__":
    main()
