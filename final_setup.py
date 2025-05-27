#!/usr/bin/env python3
"""
Final setup script for multi-AI provider Resume Customizer
"""

import subprocess
import sys
import os
from pathlib import Path

def install_dependencies():
    """Install/update all required dependencies"""
    print("🔧 Installing/updating dependencies...")
    
    # Updated requirements
    deps = [
        "anthropic>=0.40.0",
        "google-generativeai>=0.8.0", 
        "aiohttp>=3.9.1",
        "aiofiles>=23.2.1",
        "reportlab>=4.0.4",
        "fastapi>=0.104.1",
        "uvicorn[standard]>=0.24.0",
        "supabase>=2.1.0"
    ]
    
    for dep in deps:
        try:
            print(f"Installing {dep}...")
            result = subprocess.run([
                sys.executable, "-m", "pip", "install", dep
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                print(f"✅ {dep}")
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
            "SUPABASE_ANON_KEY"
        ]
        
        ai_vars = [
            "CLAUDE_API_KEY",
            "GEMINI_API_KEY", 
            "DEEPSEEK_API_KEY"
        ]
        
        missing_vars = []
        for var in required_vars:
            if var not in content or f"{var}=" not in content:
                missing_vars.append(var)
        
        # Check for at least one AI provider
        ai_found = any(var in content and f"{var}=" in content for var in ai_vars)
        
        if missing_vars:
            print(f"⚠️  Missing required variables: {missing_vars}")
        else:
            print("✅ Required environment variables present")
            
        if not ai_found:
            print("⚠️  No AI provider API keys found")
            print("   Add at least one: CLAUDE_API_KEY, GEMINI_API_KEY, or DEEPSEEK_API_KEY")
        else:
            found_providers = [var for var in ai_vars if var in content and f"{var}=" in content]
            print(f"✅ AI providers configured: {', '.join(found_providers)}")
            
    else:
        print("❌ .env file not found")
        print("   Copy .env.example to .env and fill in your API keys")
    
    # Check temp directory
    temp_dir = Path("temp_files")
    if not temp_dir.exists():
        print("⚠️  Creating temp_files directory...")
        temp_dir.mkdir(exist_ok=True)
        print("✅ temp_files directory created")
    else:
        print("✅ temp_files directory exists")

def test_imports():
    """Test that all required modules can be imported"""
    print("\n🧪 Testing imports...")
    
    test_modules = [
        ("anthropic", "Anthropic Claude"),
        ("google.generativeai", "Google Gemini"),
        ("aiohttp", "HTTP client"),
        ("aiofiles", "Async file operations"),
        ("reportlab", "PDF generation"),
        ("fastapi", "Web framework"),
        ("supabase", "Database client")
    ]
    
    failed_imports = []
    
    for module_name, description in test_modules:
        try:
            __import__(module_name)
            print(f"✅ {description}")
        except ImportError as e:
            print(f"❌ {description}: {e}")
            failed_imports.append(module_name)
    
    return len(failed_imports) == 0

def main():
    print("🚀 Resume Customizer - Multi-AI Provider Setup")
    print("=" * 50)
    
    install_dependencies()
    check_environment()
    imports_ok = test_imports()
    
    print("\n" + "=" * 50)
    
    if imports_ok:
        print("✅ Setup complete!")
        print("\n📝 Next steps:")
        print("1. Configure your .env file with API keys")
        print("2. Run tests: python quick_test.py")
        print("3. Start server: uvicorn app.main:app --reload --port 8000")
        print("4. Open browser: http://localhost:8000/login")
        print("\n🎯 New Features:")
        print("• Multiple AI providers (Claude, Gemini, DeepSeek)")
        print("• Better PDF preview handling")
        print("• Improved error handling and retries")
    else:
        print("⚠️  Some issues found. Please:")
        print("1. Install missing dependencies")
        print("2. Check your Python environment")
        print("3. Run this script again")

if __name__ == "__main__":
    main()
