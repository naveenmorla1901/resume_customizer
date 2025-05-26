# app/main.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from app.config import get_settings
from app.api import auth, resumes, customization
from pathlib import Path
import os

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="A web application for customizing LaTeX resumes using AI",
    version="1.0.0",
    debug=settings.debug
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(resumes.router, prefix="/api/resumes", tags=["resumes"])
app.include_router(customization.router, prefix="/api/customize", tags=["customization"])

# Serve static files (for PDF downloads and temp files)
app.mount("/static", StaticFiles(directory="temp_files"), name="static")

# Serve frontend static files (CSS, JS, images)
if Path("frontend").exists():
    app.mount("/assets", StaticFiles(directory="frontend"), name="frontend")

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": settings.app_name}

# Root redirect to app
@app.get("/")
async def root():
    return FileResponse("frontend/login.html") if Path("frontend/login.html").exists() else {"message": "Resume Customizer API running - visit /docs for API documentation"}

# Serve main app
@app.get("/app")
async def serve_app():
    """Serve the main application"""
    if Path("frontend/index.html").exists():
        return FileResponse("frontend/index.html")
    return {"message": "Frontend not found - visit /docs for API documentation"}

# Serve login page
@app.get("/login")
async def serve_login():
    """Serve the login page"""
    if Path("frontend/login.html").exists():
        return FileResponse("frontend/login.html")
    return {"message": "Login page not found"}

# Serve CSS files
@app.get("/css/{file_path:path}")
async def serve_css(file_path: str):
    """Serve CSS files"""
    css_file = Path("frontend/css") / file_path
    if css_file.exists():
        return FileResponse(css_file, media_type="text/css")
    return {"error": "CSS file not found"}, 404

# Serve JS files
@app.get("/js/{file_path:path}")
async def serve_js(file_path: str):
    """Serve JavaScript files"""
    js_file = Path("frontend/js") / file_path
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