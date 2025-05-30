# app/main.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from app.config import get_settings
from app.api import auth, resumes, customization
from pathlib import Path
import os
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="A web application for customizing LaTeX resumes using AI",
    version="2.1.0",
    debug=settings.debug
)

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("🚀 Starting Resume Customizer V2.1")
    
    # Initialize AI service
    try:
        from app.core.ai_service import ai_service
        providers = ai_service.get_available_providers()
        logger.info(f"✅ AI Service initialized with providers: {list(providers.keys())}")
        
        if not providers:
            logger.warning("⚠️ No AI providers available. Check your API keys in .env file.")
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize AI service: {e}")
    
    # Ensure temp directory exists
    temp_dir = Path("temp_files")
    if not temp_dir.exists():
        temp_dir.mkdir(exist_ok=True)
        logger.info("📁 Created temp_files directory")
    
    logger.info("✅ Startup complete")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("👋 Shutting down Resume Customizer")
    
    # Cleanup temp files if needed
    try:
        temp_dir = Path("temp_files")
        if temp_dir.exists():
            import os
            import time
            
            # Clean up files older than 1 hour
            current_time = time.time()
            for file_path in temp_dir.glob("*.pdf"):
                if current_time - file_path.stat().st_mtime > 3600:  # 1 hour
                    file_path.unlink()
                    
    except Exception as e:
        logger.warning(f"Cleanup warning: {e}")
    
    logger.info("✅ Shutdown complete")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================================
# STATIC FILE CONFIGURATION (FIXED)
# ========================================

# Get the frontend directory path
frontend_dir = Path(__file__).parent.parent / "frontend"

# Only mount directories that actually exist
css_dir = frontend_dir / "css"
js_dir = frontend_dir / "js"
images_dir = frontend_dir / "assets" / "images"

if css_dir.exists():
    app.mount("/assets/css", StaticFiles(directory=str(css_dir)), name="css")
    logger.info(f"✅ Mounted CSS directory: {css_dir}")

if js_dir.exists():
    app.mount("/assets/js", StaticFiles(directory=str(js_dir)), name="js")
    logger.info(f"✅ Mounted JS directory: {js_dir}")

if images_dir.exists():
    app.mount("/assets/images", StaticFiles(directory=str(images_dir)), name="images")
    logger.info(f"✅ Mounted images directory: {images_dir}")
else:
    logger.info(f"⚠️ Images directory doesn't exist: {images_dir}")

# Mount entire frontend for any other static files
if frontend_dir.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")
    logger.info(f"✅ Mounted static directory: {frontend_dir}")

# ========================================
# HTML ROUTES
# ========================================

@app.get("/")
async def root():
    """Serve the login page"""
    login_file = frontend_dir / "login.html"
    if login_file.exists():
        return FileResponse(str(login_file))
    return {"message": "Resume Customizer API", "status": "running"}

@app.get("/login")
async def login_page():
    """Serve the login page"""
    login_file = frontend_dir / "login.html"
    if login_file.exists():
        return FileResponse(str(login_file))
    return {"message": "Login page not found"}

@app.get("/app")
async def main_app():
    """Serve the main application page"""
    app_file = frontend_dir / "index.html"
    if app_file.exists():
        return FileResponse(str(app_file))
    return {"message": "App page not found"}

# ========================================
# API ROUTES
# ========================================

# Include API routers
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(resumes.router, prefix="/api/resumes", tags=["resumes"])
app.include_router(customization.router, prefix="/api/customize", tags=["customization"])

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "Resume Customizer"}

# Alternative CSS/JS serving (fallback if mounted static files don't work)
@app.get("/css/{file_path:path}")
async def serve_css(file_path: str):
    """Serve CSS files as fallback"""
    css_file = frontend_dir / "css" / file_path
    if css_file.exists():
        return FileResponse(css_file, media_type="text/css")
    return {"error": "CSS file not found"}, 404

@app.get("/js/{file_path:path}")
async def serve_js(file_path: str):
    """Serve JavaScript files as fallback"""
    js_file = frontend_dir / "js" / file_path
    if js_file.exists():
        return FileResponse(js_file, media_type="application/javascript")
    return {"error": "JS file not found"}, 404

# SPA fallback - catch-all route for client-side routing
@app.get("/{path:path}")
async def spa_fallback(request: Request, path: str):
    """Handle client-side routing"""
    # If it's an API request, don't intercept 
    if path.startswith("api/") or path.startswith("docs") or path.startswith("openapi.json"):
        return {"error": "Not found"}, 404
    
    # Serve specific frontend files if they exist
    frontend_file = Path("frontend") / path
    if frontend_file.exists() and frontend_file.is_file():
        return FileResponse(frontend_file)
    
    # Default SPA fallback to main app
    if Path("frontend/index.html").exists():
        return FileResponse("frontend/index.html")
    
    return {"message": "Frontend not available"}