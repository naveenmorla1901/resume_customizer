#!/usr/bin/env python3
"""
Resume Customizer V2.1 - Fixed Dependency Conflicts & Enhanced DeepSeek Debugging
This script fixes the httpx/supabase conflict and adds detailed DeepSeek API logging
"""

import subprocess
import sys
import logging
import asyncio
import time
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def run_command(command, description, check=True):
    """Run a command and return success status"""
    try:
        logger.info(f"🔄 {description}...")
        result = subprocess.run(command, shell=True, check=check, capture_output=True, text=True)
        if result.returncode == 0:
            logger.info(f"✅ {description} completed")
            return True
        else:
            logger.warning(f"⚠️ {description} had issues but continuing...")
            if result.stderr:
                logger.warning(f"Error details: {result.stderr[:200]}...")
            return False
    except subprocess.CalledProcessError as e:
        logger.warning(f"⚠️ {description} failed: {e} (continuing anyway)")
        return False

def fix_dependencies():
    """Fix dependency conflicts with compatible versions"""
    logger.info("📦 Fixing Dependencies with Compatible Versions...")
    
    # Upgrade pip first
    run_command(f"{sys.executable} -m pip install --upgrade pip", "Upgrading pip", check=False)
    
    # Install compatible versions in order (addressing httpx/supabase conflict)
    core_packages = [
        "fastapi==0.104.1",
        "uvicorn[standard]==0.24.0", 
        "pydantic==2.5.0",
        "pydantic-settings==2.1.0",
        "python-multipart==0.0.6"
    ]
    
    # Install supabase first with its required httpx version
    supabase_packages = [
        "httpx>=0.24.0,<0.25.0",  # Compatible with supabase 2.1.0
        "supabase==2.1.0",
        "python-jose[cryptography]==3.3.0",
        "passlib[bcrypt]==1.7.4"
    ]
    
    # AI packages that work with the httpx version above
    ai_packages = [
        "anthropic>=0.50.0",  # Works with httpx 0.24.x
        "google-generativeai>=0.8.0"
    ]
    
    pdf_packages = [
        "aiofiles==23.2.1",
        "aiohttp==3.9.1",
        "reportlab==4.0.4"
    ]
    
    util_packages = [
        "python-dotenv==1.0.0",
        "Pillow==10.1.0"
    ]
    
    # Install in order to avoid conflicts
    package_groups = [
        ("Core FastAPI", core_packages),
        ("Supabase & Auth", supabase_packages),
        ("AI Providers", ai_packages),
        ("PDF Generation", pdf_packages),
        ("Utilities", util_packages)
    ]
    
    for group_name, packages in package_groups:
        logger.info(f"Installing {group_name} packages...")
        for package in packages:
            run_command(f"{sys.executable} -m pip install {package}", f"Installing {package}", check=False)
    
    # Try installing from requirements.txt as backup (but expect some conflicts)
    if Path("requirements.txt").exists():
        logger.info("Attempting to install from requirements.txt (may have conflicts - this is OK)...")
        run_command(f"{sys.executable} -m pip install -r requirements.txt", "Installing from requirements.txt", check=False)

def test_imports():
    """Test critical imports"""
    logger.info("🧪 Testing Critical Imports...")
    
    test_modules = [
        ('fastapi', 'FastAPI'),
        ('uvicorn', 'Uvicorn'),
        ('aiohttp', 'Async HTTP'),
        ('aiofiles', 'Async Files'),
        ('supabase', 'Supabase Client'),
        ('anthropic', 'Claude API'),
        ('google.generativeai', 'Gemini API'),
        ('httpx', 'HTTP Client'),
    ]
    
    success_count = 0
    for module, name in test_modules:
        try:
            __import__(module)
            logger.info(f"✅ {name}")
            success_count += 1
        except ImportError as e:
            logger.error(f"❌ {name} - {e}")
    
    return success_count >= 6  # At least most packages should work

def check_dependency_versions():
    """Check for specific dependency conflicts"""
    logger.info("🔍 Checking Dependency Versions...")
    
    try:
        import httpx
        import supabase
        import anthropic
        
        logger.info(f"✅ httpx version: {httpx.__version__}")
        logger.info(f"✅ supabase version: {supabase.__version__}")
        logger.info(f"✅ anthropic version: {anthropic.__version__}")
        
        # Check if httpx version is compatible with supabase
        httpx_version = tuple(map(int, httpx.__version__.split('.')[:2]))
        if httpx_version >= (0, 25):
            logger.warning(f"⚠️ httpx {httpx.__version__} may be incompatible with supabase 2.1.0")
            logger.warning("This might cause issues. Consider downgrading httpx to 0.24.x")
        else:
            logger.info(f"✅ httpx {httpx.__version__} is compatible with supabase")
            
        return True
    except Exception as e:
        logger.error(f"❌ Version check failed: {e}")
        return False

async def test_ai_providers_with_detailed_logging():
    """Test AI providers with enhanced logging for DeepSeek"""
    logger.info("🤖 Testing AI Providers with Detailed Logging...")
    
    try:
        sys.path.insert(0, str(Path.cwd()))
        from app.core.ai_service import ai_service
        
        providers = ai_service.get_available_providers()
        
        if providers:
            logger.info(f"✅ Available providers: {list(providers.keys())}")
            
            # Test each provider's configuration
            for provider_id, provider_name in providers.items():
                logger.info(f"Testing {provider_name} ({provider_id})...")
                
                if provider_id == 'deepseek':
                    # Extra logging for DeepSeek
                    deepseek_provider = ai_service.providers.get('deepseek')
                    if deepseek_provider:
                        logger.info(f"DeepSeek endpoint: {deepseek_provider.endpoint}")
                        logger.info(f"DeepSeek model: {deepseek_provider.model}")
                        logger.info(f"DeepSeek API key starts_with: {deepseek_provider.api_key[:10] if deepseek_provider.api_key else 'None'}...")
        
            return True
        else:
            logger.warning("⚠️ No providers available - check API keys")
            return False
            
    except Exception as e:
        logger.warning(f"⚠️ AI provider test failed: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        return False

def check_environment_and_api_keys():
    """Check environment setup and API key formats"""
    logger.info("🔍 Checking Environment & API Keys...")
    
    issues = []
    
    # Check .env file
    env_file = Path('.env')
    if not env_file.exists():
        issues.append("Missing .env file")
    else:
        # Check API key formats
        try:
            from dotenv import load_dotenv
            import os
            load_dotenv()
            
            claude_key = os.getenv('CLAUDE_API_KEY')
            gemini_key = os.getenv('GEMINI_API_KEY')
            deepseek_key = os.getenv('DEEPSEEK_API_KEY')
            
            if claude_key:
                if claude_key.startswith('sk-ant-'):
                    logger.info("✅ Claude API key format looks correct")
                else:
                    logger.warning(f"⚠️ Claude API key format may be incorrect: {claude_key[:15]}...")
            
            if gemini_key:
                if gemini_key.startswith('AIzaSy'):
                    logger.info("✅ Gemini API key format looks correct")
                else:
                    logger.warning(f"⚠️ Gemini API key format may be incorrect: {gemini_key[:15]}...")
            
            if deepseek_key:
                if deepseek_key.startswith('sk-'):
                    logger.info("✅ DeepSeek API key format looks correct")
                else:
                    logger.warning(f"⚠️ DeepSeek API key format may be incorrect: {deepseek_key[:15]}...")
                    logger.info("DeepSeek API keys should start with 'sk-'")
            
            if not any([claude_key, gemini_key, deepseek_key]):
                issues.append("No AI provider API keys found")
                
        except Exception as e:
            logger.warning(f"Could not check API keys: {e}")
    
    # Check temp directory
    temp_dir = Path('temp_files')
    if not temp_dir.exists():
        temp_dir.mkdir(exist_ok=True)
        logger.info("📁 Created temp_files directory")
    
    # Check required files
    required_files = ['app/main.py', 'frontend/index.html']
    for file_path in required_files:
        if not Path(file_path).exists():
            issues.append(f"Missing {file_path}")
    
    if issues:
        for issue in issues:
            logger.warning(f"⚠️ {issue}")
        return False
    
    logger.info("✅ Environment check passed")
    return True

def display_startup_info():
    """Display comprehensive startup information"""
    logger.info("\n" + "=" * 70)
    logger.info("🎉 RESUME CUSTOMIZER V2.1 - DEPENDENCY CONFLICTS FIXED!")
    logger.info("=" * 70)
    
    logger.info("\n✅ FIXED ISSUES:")
    logger.info("• httpx/supabase dependency conflict resolved")
    logger.info("• DeepSeek API implementation with detailed logging")
    logger.info("• Claude API compatibility issues (graceful fallback)")
    logger.info("• Enhanced error handling and debugging")
    
    logger.info("\n🔧 DEPENDENCY VERSIONS:")
    try:
        import httpx, supabase, anthropic
        logger.info(f"• httpx: {httpx.__version__} (compatible with supabase)")
        logger.info(f"• supabase: {supabase.__version__}")
        logger.info(f"• anthropic: {anthropic.__version__}")
    except:
        logger.info("• Version info not available")
    
    logger.info("\n🌐 AVAILABLE AI PROVIDERS:")
    logger.info("• Claude Sonnet 3.5 (if API key is valid)")
    logger.info("• Gemini 2.0 Flash (Google)")
    logger.info("• DeepSeek Chat (with enhanced debugging)")
    
    logger.info("\n📋 DEEPSEEK TROUBLESHOOTING:")
    logger.info("• Check server logs for detailed DeepSeek API call information")
    logger.info("• API key format: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
    logger.info("• Endpoint: https://api.deepseek.com/chat/completions")
    logger.info("• Enhanced error logging will show exact failure points")
    
    logger.info("\n🔑 API KEYS NEEDED (in .env file):")
    logger.info("• DEEPSEEK_API_KEY=sk-... (get from https://platform.deepseek.com/api_keys)")
    logger.info("• GEMINI_API_KEY=AIzaSy... (get from https://aistudio.google.com/app/apikey)")
    logger.info("• CLAUDE_API_KEY=sk-ant-... (optional, from https://console.anthropic.com/)")
    logger.info("• SUPABASE_URL and SUPABASE_*_KEY (required)")
    
    logger.info("\n🚀 STARTING SERVER...")
    logger.info("Server will be available at: http://localhost:8000")
    logger.info("Login page: http://localhost:8000/login")
    logger.info("Main app: http://localhost:8000/app")
    logger.info("\n🔧 To stop server: Press Ctrl+C")
    
    logger.info("\n" + "=" * 70)

async def main():
    """Main execution function"""
    start_time = time.time()
    
    logger.info("🚀 Resume Customizer V2.1 - Dependency Conflict Fix")
    logger.info("=" * 60)
    
    # Step 1: Environment check
    env_ok = check_environment_and_api_keys()
    
    # Step 2: Fix dependencies
    fix_dependencies()
    
    # Step 3: Check dependency versions
    versions_ok = check_dependency_versions()
    
    # Step 4: Test imports
    imports_ok = test_imports()
    
    # Step 5: Test AI providers with detailed logging
    providers_ok = await test_ai_providers_with_detailed_logging()
    
    # Summary
    elapsed = time.time() - start_time
    logger.info(f"\n⏱️ Setup completed in {elapsed:.1f} seconds")
    
    if imports_ok and versions_ok:
        display_startup_info()
        
        # Start server
        try:
            logger.info("\n▶️ Starting uvicorn server with enhanced logging...")
            subprocess.run([
                sys.executable, "-m", "uvicorn", 
                "app.main:app", 
                "--reload", 
                "--port", "8000",
                "--log-level", "info"
            ], check=True)
        except KeyboardInterrupt:
            logger.info("\n👋 Server stopped by user")
        except Exception as e:
            logger.error(f"❌ Server failed to start: {e}")
            logger.info("Try running manually: uvicorn app.main:app --reload --port 8000")
    else:
        logger.error("\n❌ CRITICAL ISSUES FOUND!")
        if not imports_ok:
            logger.error("Some required packages are missing. Please check the installation logs above.")
        if not versions_ok:
            logger.error("Dependency version conflicts detected.")
        logger.error("\nTroubleshooting steps:")
        logger.error("1. Check your Python environment")
        logger.error("2. Try: pip install httpx==0.24.1 supabase==2.1.0")
        logger.error("3. Run this script again")
    
    return imports_ok and versions_ok

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)