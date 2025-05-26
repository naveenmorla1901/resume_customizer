# app/core/pdf_generator.py
import os
import subprocess
import tempfile
import uuid
from pathlib import Path
from typing import Optional
from app.config import get_settings

class PDFGeneratorService:
    def __init__(self):
        self.settings = get_settings()
        self.temp_dir = Path(self.settings.temp_file_directory)
        self.temp_dir.mkdir(exist_ok=True)
    
    def latex_to_pdf(self, latex_content: str, filename: Optional[str] = None) -> tuple[str, str]:
        """
        Convert LaTeX content to PDF
        Returns: (pdf_file_path, temp_dir_path)
        """
        if filename is None:
            filename = f"resume_{uuid.uuid4().hex[:8]}"
        
        # Create temporary directory for this compilation
        temp_compilation_dir = self.temp_dir / f"compile_{uuid.uuid4().hex[:8]}"
        temp_compilation_dir.mkdir(exist_ok=True)
        
        tex_file_path = temp_compilation_dir / f"{filename}.tex"
        pdf_file_path = temp_compilation_dir / f"{filename}.pdf"
        
        try:
            # Write LaTeX content to file
            with open(tex_file_path, 'w', encoding='utf-8') as f:
                f.write(latex_content)
            
            # Compile LaTeX to PDF using pdflatex
            result = subprocess.run([
                'pdflatex',
                '-interaction=nonstopmode',
                '-output-directory', str(temp_compilation_dir),
                str(tex_file_path)
            ], capture_output=True, text=True, cwd=temp_compilation_dir)
            
            if result.returncode != 0:
                raise Exception(f"LaTeX compilation failed: {result.stderr}")
            
            if not pdf_file_path.exists():
                raise Exception("PDF file was not generated")
            
            return str(pdf_file_path), str(temp_compilation_dir)
            
        except Exception as e:
            # Clean up on error
            self._cleanup_temp_dir(temp_compilation_dir)
            raise Exception(f"PDF generation error: {str(e)}")
    
    def cleanup_temp_dir(self, temp_dir_path: str):
        """Clean up temporary compilation directory"""
        self._cleanup_temp_dir(Path(temp_dir_path))
    
    def _cleanup_temp_dir(self, temp_dir: Path):
        """Helper method to clean up temporary directory"""
        try:
            if temp_dir.exists():
                import shutil
                shutil.rmtree(temp_dir)
        except Exception as e:
            print(f"Warning: Could not clean up temp directory {temp_dir}: {e}")

# Alternative implementation using online LaTeX compiler (if pdflatex not available)
class OnlinePDFGeneratorService:
    """
    Alternative PDF generator using online LaTeX compilation services
    Useful for deployment environments where LaTeX is not installed
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.temp_dir = Path(self.settings.temp_file_directory)
        self.temp_dir.mkdir(exist_ok=True)
    
    async def latex_to_pdf_online(self, latex_content: str) -> str:
        """
        Convert LaTeX to PDF using an online service like LaTeX.Online
        """
        import aiohttp
        import aiofiles
        
        url = "https://latex.ytotech.com/builds/sync"
        
        # Prepare the files for upload
        data = aiohttp.FormData()
        data.add_field('compiler', 'pdflatex')
        data.add_field('resources', latex_content, filename='main.tex', content_type='text/plain')
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, data=data) as response:
                    if response.status == 200:
                        pdf_content = await response.read()
                        
                        # Save PDF to temp file
                        temp_pdf_path = self.temp_dir / f"resume_{uuid.uuid4().hex[:8]}.pdf"
                        async with aiofiles.open(temp_pdf_path, 'wb') as f:
                            await f.write(pdf_content)
                        
                        return str(temp_pdf_path)
                    else:
                        error_text = await response.text()
                        raise Exception(f"Online LaTeX compilation failed: {error_text}")
                        
        except Exception as e:
            raise Exception(f"Online PDF generation error: {str(e)}")

# Initialize PDF generator service
# Use local LaTeX installation by default, fallback to online service if needed
try:
    # Check if pdflatex is available
    subprocess.run(['pdflatex', '--version'], capture_output=True)
    pdf_generator = PDFGeneratorService()
    PDF_GENERATION_METHOD = "local"
except (subprocess.CalledProcessError, FileNotFoundError):
    pdf_generator = OnlinePDFGeneratorService()
    PDF_GENERATION_METHOD = "online"
    print("Warning: pdflatex not found. Using online PDF generation service.")