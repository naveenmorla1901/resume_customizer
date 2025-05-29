import subprocess
import sys
import logging
import asyncio
import time
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Function to Run Shell Commands Safely
def run_command(command, description, check=True):
    """Run a shell command and log its execution"""
    try:
        logger.info(f"🔄 {description}...")
        result = subprocess.run(command, shell=True, check=check, capture_output=True, text=True)
        if result.returncode == 0:
            logger.info(f"✅ {description} completed")
            return True
        else:
            logger.warning(f"⚠️ {description} encountered issues")
            return False
    except subprocess.CalledProcessError as e:
        logger.warning(f"⚠️ {description} failed: {e}")
        return False

# Dependency Management
def fix_dependencies():
    """Install required dependencies"""
    logger.info("📦 Fixing Dependencies...")

    dependencies = [
        "fastapi==0.104.1",
        "uvicorn[standard]==0.24.0",
        "pydantic==2.5.0",
        "pydantic-settings==2.1.0",
        "python-multipart==0.0.6",
        "supabase==2.1.0",
        "python-jose[cryptography]==3.3.0",
        "passlib[bcrypt]==1.7.4",
        "anthropic>=0.50.0",
        "google-generativeai>=0.8.0",
        "httpx>=0.25.0",
        "aiofiles==23.2.1",
        "aiohttp==3.9.1",
        "reportlab==4.0.4",
        "python-dotenv==1.0.0",
        "Pillow==10.1.0"
    ]

    for package in dependencies:
        run_command(f"{sys.executable} -m pip install {package}", f"Installing {package}", check=False)

    # Install from requirements.txt as a fallback
    if Path("requirements.txt").exists():
        run_command(f"{sys.executable} -m pip install -r requirements.txt", "Installing from requirements.txt", check=False)

# Environment Check
def check_environment():
    """Validate environment setup"""
    logger.info("🔍 Checking Environment...")

    issues = []
    required_files = ["app/main.py", "frontend/index.html"]

    if not Path(".env").exists():
        issues.append("Missing .env file")

    for file_path in required_files:
        if not Path(file_path).exists():
            issues.append(f"Missing {file_path}")

    if issues:
        for issue in issues:
            logger.warning(f"⚠️ {issue}")
        return False

    logger.info("✅ Environment check passed")
    return True

# Import Testing
def test_imports():
    """Test necessary package imports"""
    logger.info("🧪 Testing Imports...")

    test_modules = [
        ("fastapi", "FastAPI"),
        ("uvicorn", "Uvicorn"),
        ("aiohttp", "Async HTTP"),
        ("aiofiles", "Async Files"),
        ("supabase", "Supabase Client"),
        ("anthropic", "Claude API (optional)"),
        ("google.generativeai", "Gemini API (optional)")
    ]

    success_count = sum(
        1 for module, name in test_modules if __import__(module, fromlist=[""]) and logger.info(f"✅ {name}")
    )

    return success_count >= 5

# AI Provider Testing
async def test_ai_providers():
    """Verify AI providers are accessible"""
    logger.info("🤖 Testing AI Providers...")

    try:
        sys.path.insert(0, str(Path.cwd()))
        from app.core.ai_service import ai_service

        providers = ai_service.get_available_providers()

        if providers:
            logger.info(f"✅ Available providers: {list(providers.keys())}")
            return True
        else:
            logger.warning("⚠️ No providers available - check API keys")
            return False
    except Exception as e:
        logger.warning(f"⚠️ AI provider test failed: {e}")
        return False

# Server Startup
def start_server():
    """Launch Uvicorn server"""
    try:
        logger.info("▶️ Starting Uvicorn server...")
        subprocess.run(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000", "--log-level", "info"],
            check=True
        )
    except KeyboardInterrupt:
        logger.info("👋 Server stopped by user")
    except Exception as e:
        logger.error(f"❌ Server failed to start: {e}")
        logger.info("Try running manually: uvicorn app.main:app --reload --port 8000")

# Main Execution Flow
async def main():
    """Run the complete setup process"""
    start_time = time.time()

    logger.info("🚀 Resume Customizer V2.1 - Setup Start")

    env_ok = check_environment()
    fix_dependencies()
    imports_ok = test_imports()
    providers_ok = await test_ai_providers()

    elapsed_time = time.time() - start_time
    logger.info(f"⏱️ Setup completed in {elapsed_time:.1f} seconds")

    if imports_ok:
        start_server()
    else:
        logger.error("❌ CRITICAL ISSUES FOUND!")
        logger.error("Ensure dependencies are installed and re-run the script.")

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
