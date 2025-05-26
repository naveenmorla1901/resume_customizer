# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.config import get_settings
from app.api import auth, resumes, customization
from pathlib import Path

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
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(resumes.router, prefix="/api/resumes", tags=["resumes"])
app.include_router(customization.router, prefix="/api/customize", tags=["customization"])

# Serve static files (for PDF downloads)
app.mount("/static", StaticFiles(directory="temp_files"), name="static")

# Health check endpoint
@app.get("/")
async def root():
    return {"message": "Resume Customizer API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.app_name}

# Serve frontend (if using static HTML/JS frontend)
@app.get("/app/{file_path:path}")
async def serve_frontend(file_path: str):
    """Serve frontend files"""
    frontend_dir = Path("frontend")
    if file_path == "" or file_path == "/":
        file_path = "index.html"
    
    file_location = frontend_dir / file_path
    if file_location.exists():
        return FileResponse(file_location)
    return FileResponse(frontend_dir / "index.html")  # SPA fallback