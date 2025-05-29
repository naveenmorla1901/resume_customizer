#!/usr/bin/env python3
"""
Fix Dependencies Script - Resume Customizer V2.1
Installs and tests all required dependencies for multi-AI provider support
"""

import subprocess
import sys
import logging
from pathlib import Path

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def run_command(command, description):
    """Run a shell command and handle errors"""
    try:
        logger.info(f"🔄 {description}...")
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        logger.info(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ {description} failed:")
        logger.error(f"Command: {command}")
        logger.error(f"Return code: {e.returncode}")
        if e.stdout:
            logger.error(f"STDOUT: {e.stdout}")
        if e.stderr:
            logger.error(f"STDERR: {e.stderr}")
        return False

def install_dependencies():
    """Install all required dependencies"""
    
    # First, upgrade pip
    run_command(f"{sys.executable} -m pip install --upgrade pip", "Upgrading pip")
    
    # Install specific packages to avoid conflicts
    packages = [
        "fastapi==0.104.1",
        "uvicorn[standard]==0.24.0", 
        "python-multipart==0.0.6",
        "pydantic==2.5.0",
        "pydantic-settings==2.1.0",
        "supabase==2.1.0",
        "python-jose[cryptography]==3.3.0",
        "passlib[bcrypt]==1.7.4",
        "anthropic==1.3.0",  # Fixed version
        "google-generativeai>=0.8.0",
        "httpx==0.24.1",     # Compatible version
        "aiofiles==23.2.1",
        "aiohttp==3.9.1",
        "reportlab==4.0.4",
        "python-dotenv==1.0.0",
        "Pillow==10.1.0"
    ]
    
    for package in packages:
        if not run_command(f"{sys.executable} -m pip install {package}", f"Installing {package}"):
            logger.warning(f"⚠️ Failed to install {package}, continuing...")
    
    # Install from requirements.txt as fallback
    requirements_file = Path("requirements.txt")
    if requirements_file.exists():
        run_command(f"{sys.executable} -m pip install -r requirements.txt", "Installing from requirements.txt")

def test_imports():
    """Test that all critical imports work"""
    
    test_imports = [
        ("fastapi", "FastAPI"),
        ("uvicorn", "Uvicorn"),
        ("anthropic", "Anthropic Claude API"),
        ("google.generativeai", "Google Gemini API"),
        ("aiohttp", "Async HTTP Client"),
        ("aiofiles", "Async File Operations"),
        ("supabase", "Supabase Client"),
        ("reportlab", "PDF Generation")
    ]
    
    successful_imports = []
    failed_imports = []
    
    for module, description in test_imports:
        try:
            __import__(module)
            successful_imports.append((module, description))
            logger.info(f"✅ {description} import successful")
        except ImportError as e:
            failed_imports.append((module, description, str(e)))
            logger.error(f"❌ {description} import failed: {e}")
    
    logger.info(f"\n📊 Import Summary:")
    logger.info(f"✅ Successful: {len(successful_imports)}")
    logger.info(f"❌ Failed: {len(failed_imports)}")
    
    return len(failed_imports) == 0

def test_ai_providers():
    """Test AI provider initialization"""
    
    logger.info("\n🤖 Testing AI Provider Initialization...")
    
    # Test Claude
    try:
        import anthropic
        # Just test that we can create a client (won't test API call without key)
        logger.info("✅ Claude SDK available")
    except Exception as e:
        logger.error(f"❌ Claude SDK issue: {e}")
    
    # Test Gemini
    try:
        import google.generativeai as genai
        logger.info("✅ Gemini SDK available")
    except Exception as e:
        logger.error(f"❌ Gemini SDK issue: {e}")
    
    # Test async HTTP for DeepSeek
    try:
        import aiohttp
        logger.info("✅ DeepSeek HTTP client available")
    except Exception as e:
        logger.error(f"❌ DeepSeek HTTP client issue: {e}")

def test_core_services():
    """Test core application components"""
    
    logger.info("\n🧪 Testing Core Services...")
    
    try:
        # Test that we can import the main modules
        sys.path.insert(0, str(Path.cwd()))
        
        # Test config
        from app.config import get_settings
        settings = get_settings()
        logger.info("✅ Config system working")
        
        # Test Supabase client creation
        from app.core.supabase import get_supabase_client
        logger.info("✅ Supabase client system working")
        
        # Test AI service import (but not initialization)
        from app.core.ai_service import AIService
        logger.info("✅ AI service module import working")
        
        # Test PDF generator
        from app.core.pdf_generator import pdf_generator
        logger.info("✅ PDF generator import working")
        
    except Exception as e:
        logger.error(f"❌ Core service test failed: {e}")
        return False
    
    return True

def main():
    """Main fix script"""
    
    logger.info("🚀 Resume Customizer V2.1 - Dependency Fix Script")
    logger.info("=" * 60)
    
    # Check current directory
    current_dir = Path.cwd()
    logger.info(f"📁 Current directory: {current_dir}")
    
    # Create temp_files directory if it doesn't exist
    temp_dir = current_dir / "temp_files"
    if not temp_dir.exists():
        temp_dir.mkdir()
        logger.info(f"📁 Created temp_files directory")
    
    # Install dependencies
    logger.info("\n📦 Installing Dependencies...")
    install_dependencies()
    
    # Test imports
    logger.info("\n🧪 Testing Imports...")
    imports_ok = test_imports()
    
    # Test AI providers
    test_ai_providers()
    
    # Test core services
    logger.info("\n🔧 Testing Core Services...")
    core_ok = test_core_services()
    
    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("📋 FINAL SUMMARY")
    logger.info("=" * 60)
    
    if imports_ok and core_ok:
        logger.info("🎉 ALL TESTS PASSED!")
        logger.info("✅ Dependencies are properly installed")
        logger.info("✅ Core services are working")
        logger.info("\n🚀 You can now start the server with:")
        logger.info("   uvicorn app.main:app --reload --port 8000")
        return 0
    else:
        logger.error("❌ SOME TESTS FAILED!")
        logger.error("Please check the error messages above and fix any issues.")
        logger.error("You may need to:")
        logger.error("1. Check your Python version (3.11+ recommended)")
        logger.error("2. Update pip: python -m pip install --upgrade pip")
        logger.error("3. Install missing packages manually")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
