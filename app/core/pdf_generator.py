# app/core/pdf_generator.py
import os
import subprocess
import tempfile
import uuid
import asyncio
from pathlib import Path
from typing import Optional, Tuple
from app.config import get_settings

class PDFGeneratorService:
    def __init__(self):
        self.settings = get_settings()
        self.temp_dir = Path(self.settings.temp_file_directory)
        self.temp_dir.mkdir(exist_ok=True)
    
    async def latex_to_pdf(self, latex_content: str, filename: Optional[str] = None) -> str:
        """
        Convert LaTeX content to PDF
        Returns: pdf_file_path (string)
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
            
            # Run pdflatex in a thread to avoid blocking
            result = await asyncio.create_subprocess_exec(
                'pdflatex',
                '-interaction=nonstopmode',
                '-output-directory', str(temp_compilation_dir),
                str(tex_file_path),
                cwd=temp_compilation_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await result.communicate()
            
            if result.returncode != 0:
                raise Exception(f"LaTeX compilation failed: {stderr.decode()}")
            
            if not pdf_file_path.exists():
                raise Exception("PDF file was not generated")
            
            return str(pdf_file_path)
            
        except Exception as e:
            # Clean up on error
            await self._cleanup_temp_dir_async(temp_compilation_dir)
            raise Exception(f"PDF generation error: {str(e)}")
    
    async def cleanup_temp_file(self, pdf_path: str):
        """Clean up a temporary PDF file and its directory"""
        try:
            pdf_file = Path(pdf_path)
            if pdf_file.exists():
                temp_dir = pdf_file.parent
                await self._cleanup_temp_dir_async(temp_dir)
        except Exception as e:
            print(f"Warning: Could not clean up temp file {pdf_path}: {e}")
    
    async def _cleanup_temp_dir_async(self, temp_dir: Path):
        """Helper method to clean up temporary directory asynchronously"""
        try:
            if temp_dir.exists():
                import shutil
                await asyncio.to_thread(shutil.rmtree, temp_dir)
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
    
    async def latex_to_pdf(self, latex_content: str, filename: Optional[str] = None) -> str:
        """
        Convert LaTeX to PDF using an online service
        Returns: pdf_file_path (string)
        """
        try:
            import aiohttp
        except ImportError:
            raise Exception("aiohttp is required for online PDF generation. Install with: pip install aiohttp")
        
        url = "https://latex.ytotech.com/builds/sync"
        
        # Prepare the files for upload
        data = aiohttp.FormData()
        data.add_field('compiler', 'pdflatex')
        data.add_field('resources', latex_content, filename='main.tex', content_type='text/plain')
        
        try:
            timeout = aiohttp.ClientTimeout(total=30)  # 30 second timeout
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(url, data=data) as response:
                    if response.status == 200:
                        pdf_content = await response.read()
                        
                        # Save PDF to temp file
                        if filename is None:
                            filename = f"resume_{uuid.uuid4().hex[:8]}"
                        temp_pdf_path = self.temp_dir / f"{filename}.pdf"
                        
                        with open(temp_pdf_path, 'wb') as f:
                            f.write(pdf_content)
                        
                        return str(temp_pdf_path)
                    else:
                        error_text = await response.text()
                        raise Exception(f"Online LaTeX compilation failed (HTTP {response.status}): {error_text}")
                        
        except asyncio.TimeoutError:
            raise Exception("Online PDF generation timed out")
        except Exception as e:
            raise Exception(f"Online PDF generation error: {str(e)}")
    
    async def cleanup_temp_file(self, pdf_path: str):
        """Clean up a temporary PDF file"""
        try:
            pdf_file = Path(pdf_path)
            if pdf_file.exists():
                await asyncio.to_thread(pdf_file.unlink)
        except Exception as e:
            print(f"Warning: Could not clean up temp file {pdf_path}: {e}")

# Initialize PDF generator service
# Use local LaTeX installation by default, fallback to online service if needed
async def initialize_pdf_generator():
    """Initialize the appropriate PDF generator"""
    try:
        # Check if pdflatex is available
        result = await asyncio.create_subprocess_exec(
            'pdflatex', '--version',
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await result.communicate()
        
        if result.returncode == 0:
            return PDFGeneratorService(), "local"
        else:
            raise Exception("pdflatex not working")
            
    except Exception:
        print("Warning: pdflatex not found. Using online PDF generation service.")
        return OnlinePDFGeneratorService(), "online"

# Create a global instance (will be initialized in main.py)
pdf_generator = None
PDF_GENERATION_METHOD = None

# Temporary fallback for immediate use
try:
    subprocess.run(['pdflatex', '--version'], capture_output=True, check=True)
    pdf_generator = PDFGeneratorService()
    PDF_GENERATION_METHOD = "local"
except (subprocess.CalledProcessError, FileNotFoundError):
    pdf_generator = OnlinePDFGeneratorService()
    PDF_GENERATION_METHOD = "online"
    print("Warning: pdflatex not found. Using online PDF generation service.")
