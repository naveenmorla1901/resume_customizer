@echo off
echo =================================================================
echo Resume Customizer V2.1 - Complete Fix Script
echo =================================================================
echo.

echo 🔧 Step 1: Installing Fixed Dependencies...
echo.

REM Upgrade pip first
python -m pip install --upgrade pip

REM Install specific compatible versions
echo Installing core FastAPI dependencies...
python -m pip install fastapi==0.104.1 uvicorn[standard]==0.24.0 python-multipart==0.0.6 pydantic==2.5.0 pydantic-settings==2.1.0

echo Installing authentication and database dependencies...
python -m pip install supabase==2.1.0 python-jose[cryptography]==3.3.0 passlib[bcrypt]==1.7.4

echo Installing AI provider dependencies with fixed versions...
python -m pip install "anthropic==1.3.0" "google-generativeai>=0.8.0" "httpx==0.24.1"

echo Installing PDF generation dependencies...
python -m pip install aiofiles==23.2.1 aiohttp==3.9.1 reportlab==4.0.4

echo Installing utility dependencies...
python -m pip install python-dotenv==1.0.0 Pillow==10.1.0

echo.
echo 🧪 Step 2: Testing Dependencies...
echo.

REM Test critical imports
python -c "import fastapi; print('✅ FastAPI import OK')" 2>nul || echo "❌ FastAPI import failed"
python -c "import anthropic; print('✅ Anthropic import OK')" 2>nul || echo "❌ Anthropic import failed"
python -c "import google.generativeai; print('✅ Gemini import OK')" 2>nul || echo "❌ Gemini import failed"
python -c "import aiohttp; print('✅ aiohttp import OK')" 2>nul || echo "❌ aiohttp import failed"
python -c "import supabase; print('✅ Supabase import OK')" 2>nul || echo "❌ Supabase import failed"

echo.
echo 🤖 Step 3: Testing AI Provider Initialization...
echo.

REM Test the provider system
python test_providers.py

echo.
echo 🚀 Step 4: Ready to Start Server...
echo.

echo Your Resume Customizer should now be fixed! To start the server:
echo.
echo    uvicorn app.main:app --reload --port 8000
echo.
echo Then open: http://localhost:8000/login
echo.
echo =================================================================
echo Fix Complete! Check the output above for any remaining issues.
echo =================================================================

pause
