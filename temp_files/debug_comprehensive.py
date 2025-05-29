#!/usr/bin/env python3
"""
Comprehensive Debug Script for Resume Customizer
Identifies and fixes common issues with the application
"""

import asyncio
import logging
import sys
import os
import traceback
from pathlib import Path

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def check_environment():
    """Check environment and configuration"""
    logger.info("🔍 Checking Environment...")
    
    # Check Python version
    python_version = sys.version_info
    logger.info(f"Python version: {python_version.major}.{python_version.minor}.{python_version.micro}")
    
    if python_version < (3, 8):
        logger.error("❌ Python 3.8+ required")
        return False
    
    # Check current directory
    current_dir = Path.cwd()
    logger.info(f"Current directory: {current_dir}")
    
    # Check for required files
    required_files = ['.env', 'requirements.txt', 'app/main.py', 'frontend/index.html']
    missing_files = []
    
    for file_path in required_files:
        if not (current_dir / file_path).exists():
            missing_files.append(file_path)
    
    if missing_files:
        logger.error(f"❌ Missing files: {missing_files}")
        return False
    
    logger.info("✅ Environment check passed")
    return True

def check_dependencies():
    """Check if all dependencies are installed"""
    logger.info("📦 Checking Dependencies...")
    
    required_modules = [
        'fastapi',
        'uvicorn', 
        'anthropic',
        'google.generativeai',
        'aiohttp',
        'aiofiles',
        'supabase',
        'pydantic',
        'python_dotenv'
    ]
    
    missing_modules = []
    for module in required_modules:
        try:
            __import__(module)
            logger.info(f"✅ {module}")
        except ImportError:
            missing_modules.append(module)
            logger.error(f"❌ {module}")
    
    if missing_modules:
        logger.error(f"Missing modules: {missing_modules}")
        logger.info("Run: pip install -r requirements.txt")
        return False
    
    logger.info("✅ All dependencies available")
    return True

def check_env_file():
    """Check .env file configuration"""
    logger.info("⚙️ Checking Environment Variables...")
    
    try:
        from dotenv import load_dotenv
        load_dotenv()
        
        required_vars = [
            'SUPABASE_URL',
            'SUPABASE_ANON_KEY', 
            'SUPABASE_SERVICE_KEY'
        ]
        
        ai_vars = [
            'CLAUDE_API_KEY',
            'GEMINI_API_KEY', 
            'DEEPSEEK_API_KEY'
        ]
        
        # Check required vars
        missing_required = []
        for var in required_vars:
            if not os.getenv(var):
                missing_required.append(var)
        
        if missing_required:
            logger.error(f"❌ Missing required variables: {missing_required}")
            return False
        
        # Check AI provider vars
        available_ai = []
        for var in ai_vars:
            if os.getenv(var):
                provider_name = var.replace('_API_KEY', '').lower()
                available_ai.append(provider_name)
                logger.info(f"✅ {provider_name} API key configured")
        
        if not available_ai:
            logger.error("❌ No AI provider API keys configured")
            return False
        
        logger.info(f"✅ Available AI providers: {available_ai}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Environment check failed: {e}")
        return False

async def test_ai_providers():
    """Test AI provider initialization"""
    logger.info("🤖 Testing AI Providers...")
    
    try:
        # Add project root to path
        sys.path.insert(0, str(Path.cwd()))
        
        from app.core.ai_service import ai_service
        
        providers = ai_service.get_available_providers()
        
        if not providers:
            logger.error("❌ No AI providers initialized")
            return False
        
        for provider_id, provider_name in providers.items():
            logger.info(f"✅ {provider_name} ({provider_id})")
        
        logger.info("✅ AI providers working")
        return True
        
    except Exception as e:
        logger.error(f"❌ AI provider test failed: {e}")
        traceback.print_exc()
        return False

async def test_api_endpoints():
    """Test API endpoints"""
    logger.info("🌐 Testing API Endpoints...")
    
    try:
        from app.api.customization import get_available_providers
        
        response = await get_available_providers()
        
        if hasattr(response, 'available_providers'):
            providers = response.available_providers
            default = response.default_provider
            
            logger.info(f"✅ Providers endpoint working")
            logger.info(f"Available: {providers}")
            logger.info(f"Default: {default}")
            return True
        else:
            logger.error("❌ Invalid API response format")
            return False
            
    except Exception as e:
        logger.error(f"❌ API endpoint test failed: {e}")
        traceback.print_exc()
        return False

def test_claude_compatibility():
    """Test Claude API compatibility"""
    logger.info("🔮 Testing Claude Compatibility...")
    
    try:
        import anthropic
        from app.config import get_settings
        
        settings = get_settings()
        
        if not settings.claude_api_key:
            logger.warning("⚠️ No Claude API key configured")
            return True
            
        # Test client creation
        client = anthropic.Anthropic(api_key=settings.claude_api_key)
        logger.info("✅ Claude client created successfully")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Claude compatibility test failed: {e}")
        return False

def create_temp_directory():
    """Ensure temp_files directory exists"""
    temp_dir = Path('temp_files')
    if not temp_dir.exists():
        temp_dir.mkdir()
        logger.info("📁 Created temp_files directory")
    return True

async def run_all_tests():
    """Run comprehensive test suite"""
    logger.info("🚀 Resume Customizer - Comprehensive Debug Test")
    logger.info("=" * 60)
    
    tests = [
        ("Environment Check", check_environment),
        ("Dependencies Check", check_dependencies), 
        ("Environment Variables", check_env_file),
        ("Temp Directory", create_temp_directory),
        ("Claude Compatibility", test_claude_compatibility),
        ("AI Providers", test_ai_providers),
        ("API Endpoints", test_api_endpoints)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        logger.info(f"\n📋 Running: {test_name}")
        try:
            if asyncio.iscoroutinefunction(test_func):
                result = await test_func()
            else:
                result = test_func()
            results.append((test_name, result))
        except Exception as e:
            logger.error(f"❌ {test_name} crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("📋 TEST SUMMARY")
    logger.info("=" * 60)
    
    passed = 0
    failed = 0
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        logger.info(f"{test_name}: {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    logger.info(f"\nTotal: {len(results)} | Passed: {passed} | Failed: {failed}")
    
    if failed == 0:
        logger.info("\n🎉 ALL TESTS PASSED!")
        logger.info("Your Resume Customizer should work correctly.")
        logger.info("\n🚀 Start server with:")
        logger.info("uvicorn app.main:app --reload --port 8000")
    else:
        logger.error(f"\n❌ {failed} TESTS FAILED!")
        logger.error("Please fix the issues above before starting the server.")
        
        # Provide specific guidance
        if any("Dependencies" in name for name, result in results if not result):
            logger.info("\n💡 Fix dependencies:")
            logger.info("pip install -r requirements.txt")
            
        if any("Environment" in name for name, result in results if not result):
            logger.info("\n💡 Fix environment:")
            logger.info("Check your .env file and ensure all API keys are set")
            
        if any("Claude" in name for name, result in results if not result):
            logger.info("\n💡 Fix Claude:")
            logger.info("pip install anthropic==1.3.0")
    
    return failed == 0

if __name__ == "__main__":
    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)
