#!/usr/bin/env python3
"""
Resume Customizer - Quick Start with Auto-Fix
This script automatically fixes common issues and starts the server
"""

import subprocess
import sys
import logging
import asyncio
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def run_command(command, description):
    """Run a command and return success status"""
    try:
        logger.info(f"🔄 {description}...")
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        logger.info(f"✅ {description} completed")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ {description} failed: {e}")
        return False

def fix_dependencies():
    """Fix dependency issues"""
    logger.info("📦 Fixing Dependencies...")
    
    # Key packages with specific versions
    packages = [
        "anthropic>=0.50.0",    # Fixed version for compatibility
        "httpx>=0.25.0",       # Compatible with anthropic
        "fastapi==0.104.1",
        "uvicorn[standard]==0.24.0",
        "supabase==2.1.0",
        "aiohttp==3.9.1",
        "aiofiles==23.2.1",
        "google-generativeai>=0.8.0"
    ]
    
    for package in packages:
        run_command(f"{sys.executable} -m pip install {package}", f"Installing {package}")

async def quick_test():
    """Quick functionality test"""
    logger.info("🧪 Quick Test...")
    
    try:
        # Test imports
        import fastapi
        import anthropic
        import aiohttp
        import supabase
        logger.info("✅ Core imports working")
        
        # Test AI service
        sys.path.insert(0, str(Path.cwd()))
        from app.core.ai_service import ai_service
        
        providers = ai_service.get_available_providers()
        if providers:
            logger.info(f"✅ AI providers available: {list(providers.keys())}")
        else:
            logger.warning("⚠️ No AI providers available - check API keys")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Quick test failed: {e}")
        return False

def create_startup_info():
    """Display startup information"""
    logger.info("\n" + "=" * 60)
    logger.info("🚀 RESUME CUSTOMIZER - READY TO START")
    logger.info("=" * 60)
    logger.info("\n📋 What's Fixed:")
    logger.info("✅ Claude API compatibility issues (graceful fallback)")
    logger.info("✅ DeepSeek API implementation (OpenAI-compatible format)")
    logger.info("✅ Provider loading infinite loop")
    logger.info("✅ Added smooth loading animations")
    logger.info("✅ PDF generation errors")
    logger.info("✅ Dependency version conflicts")
    
    logger.info("\n🌐 Starting Server...")
    logger.info("Server will be available at: http://localhost:8000")
    logger.info("Login page: http://localhost:8000/login")
    logger.info("Main app: http://localhost:8000/app")
    
    logger.info("\n📝 API Keys Required:")
    logger.info("• CLAUDE_API_KEY (optional)")
    logger.info("• GEMINI_API_KEY (recommended)")  
    logger.info("• DEEPSEEK_API_KEY (recommended)")
    logger.info("• SUPABASE_URL and keys (required)")
    
    logger.info("\n🔧 To stop server: Press Ctrl+C")
    logger.info("=" * 60)

async def main():
    """Main startup function"""
    logger.info("🚀 Resume Customizer - Auto-Fix & Start")
    logger.info("=" * 50)
    
    # Step 1: Fix dependencies
    fix_dependencies()
    
    # Step 2: Quick test
    test_ok = await quick_test()
    
    if not test_ok:
        logger.error("❌ System not ready. Run debug_comprehensive.py for detailed diagnostics.")
        return False
    
    # Step 3: Display info
    create_startup_info()
    
    # Step 4: Start server
    try:
        logger.info("\n🚀 Starting uvicorn server...")
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
        logger.info("Try running: uvicorn app.main:app --reload --port 8000")
    
    return True

if __name__ == "__main__":
    asyncio.run(main())
