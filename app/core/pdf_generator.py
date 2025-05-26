# app/core/pdf_generator.py - Fixed with better HTTP status handling
import os
import subprocess
import tempfile
import uuid
import asyncio
import logging
from pathlib import Path
from typing import Optional, Tuple
from app.config import get_settings

# Set up logging
logger = logging.getLogger(__name__)

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
                logger.error(f"LaTeX compilation failed: {stderr.decode()}")
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
            logger.warning(f"Could not clean up temp file {pdf_path}: {e}")
    
    async def _cleanup_temp_dir_async(self, temp_dir: Path):
        """Helper method to clean up temporary directory asynchronously"""
        try:
            if temp_dir.exists():
                import shutil
                await asyncio.to_thread(shutil.rmtree, temp_dir)
        except Exception as e:
            logger.warning(f"Could not clean up temp directory {temp_dir}: {e}")

# Improved online PDF generator with better HTTP status handling
class OnlinePDFGeneratorService:
    """
    Alternative PDF generator using online LaTeX compilation services
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.temp_dir = Path(self.settings.temp_file_directory)
        self.temp_dir.mkdir(exist_ok=True)
        
        # Multiple LaTeX services as fallbacks
        self.services = [
            {
                "name": "YtoTech LaTeX",
                "url": "https://latex.ytotech.com/builds/sync",
                "method": "ytotech"
            },
            {
                "name": "LaTeX Online (Alternative)",
                "url": "https://latexonline.cc/compile",
                "method": "alternative"
            }
        ]
    
    async def latex_to_pdf(self, latex_content: str, filename: Optional[str] = None) -> str:
        """
        Convert LaTeX to PDF using online services with fallbacks
        Returns: pdf_file_path (string)
        """
        if filename is None:
            filename = f"resume_{uuid.uuid4().hex[:8]}"
        
        # Try each service until one works
        last_error = None
        
        for service in self.services:
            try:
                logger.info(f"Trying PDF generation with {service['name']}")
                
                if service['method'] == 'ytotech':
                    return await self._compile_with_ytotech(latex_content, filename)
                elif service['method'] == 'alternative':
                    return await self._compile_with_latexonline(latex_content, filename)
                    
            except Exception as e:
                logger.warning(f"PDF generation failed with {service['name']}: {e}")
                last_error = e
                continue
        
        # If all services failed, try a simple local approach
        try:
            return await self._create_simple_pdf(latex_content, filename)
        except Exception as e:
            logger.error(f"All PDF generation methods failed: {e}")
            raise Exception(f"PDF generation failed with all services. Last error: {last_error}")
    
    async def _compile_with_ytotech(self, latex_content: str, filename: str) -> str:
        """Try YtoTech LaTeX service with proper HTTP status handling"""
        try:
            import aiohttp
        except ImportError:
            raise Exception("aiohttp is required for online PDF generation")
        
        url = "https://latex.ytotech.com/builds/sync"
        
        # Prepare form data
        data = aiohttp.FormData()
        data.add_field('compiler', 'pdflatex')
        data.add_field('resources', latex_content, filename='main.tex', content_type='text/plain')
        
        try:
            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(url, data=data) as response:
                    logger.info(f"YtoTech response status: {response.status}")
                    
                    # HTTP 200 or 201 are both success for this service
                    if response.status in [200, 201]:
                        content_type = response.headers.get('content-type', '')
                        logger.info(f"Response content-type: {content_type}")
                        
                        pdf_content = await response.read()
                        
                        # Check if it's actually PDF content
                        if pdf_content.startswith(b'%PDF'):
                            logger.info(f"YtoTech returned valid PDF content ({len(pdf_content)} bytes)")
                            return await self._save_pdf_content(pdf_content, filename)
                        else:
                            # Try to decode as text for error message
                            try:
                                error_text = pdf_content.decode('utf-8')
                                raise Exception(f"LaTeX compilation error: {error_text[:200]}")
                            except UnicodeDecodeError:
                                raise Exception("Service returned invalid PDF data")
                    else:
                        error_msg = await self._safe_read_error(response)
                        raise Exception(f"YtoTech service error (HTTP {response.status}): {error_msg}")
                        
        except asyncio.TimeoutError:
            raise Exception("YtoTech service timed out")
        except Exception as e:
            raise Exception(f"YtoTech service error: {str(e)}")
    
    async def _compile_with_latexonline(self, latex_content: str, filename: str) -> str:
        """Try LaTeX Online service"""
        try:
            import aiohttp
        except ImportError:
            raise Exception("aiohttp is required for online PDF generation")
        
        url = "https://latexonline.cc/compile"
        
        # Prepare form data
        data = aiohttp.FormData()
        data.add_field('filecontents[]', latex_content, filename='main.tex')
        data.add_field('filename[]', 'main.tex')
        
        try:
            timeout = aiohttp.ClientTimeout(total=30)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(url, data=data) as response:
                    logger.info(f"LaTeX Online response status: {response.status}")
                    
                    if response.status == 200:
                        content_type = response.headers.get('content-type', '')
                        logger.info(f"Response content-type: {content_type}")
                        
                        if 'application/pdf' in content_type:
                            pdf_content = await response.read()
                            return await self._save_pdf_content(pdf_content, filename)
                        else:
                            # Try to read as text for error message
                            try:
                                error_text = await response.text()
                                raise Exception(f"Service returned non-PDF content: {error_text[:200]}")
                            except UnicodeDecodeError:
                                raise Exception(f"Service returned invalid response (status {response.status})")
                    else:
                        # Handle error response safely
                        error_msg = await self._safe_read_error(response)
                        raise Exception(f"LaTeX Online service error (HTTP {response.status}): {error_msg}")
                        
        except asyncio.TimeoutError:
            raise Exception("LaTeX Online service timed out")
        except Exception as e:
            raise Exception(f"LaTeX Online service error: {str(e)}")
    
    async def _safe_read_error(self, response) -> str:
        """Safely read error response, handling both text and binary data"""
        try:
            # First try to read as text
            error_text = await response.text()
            return error_text[:500]  # Limit error message length
        except UnicodeDecodeError:
            try:
                # If text fails, read as bytes and decode safely
                error_bytes = await response.read()
                return error_bytes.decode('utf-8', errors='ignore')[:500]
            except Exception:
                return f"Unable to read error response (status {response.status})"
    
    async def _save_pdf_content(self, pdf_content: bytes, filename: str) -> str:
        """Save PDF content to file"""
        temp_pdf_path = self.temp_dir / f"{filename}.pdf"
        
        try:
            with open(temp_pdf_path, 'wb') as f:
                f.write(pdf_content)
            
            # Verify the file was written correctly
            if not temp_pdf_path.exists() or temp_pdf_path.stat().st_size == 0:
                raise Exception("PDF file was not written correctly")
            
            logger.info(f"PDF saved successfully: {temp_pdf_path} ({len(pdf_content)} bytes)")
            return str(temp_pdf_path)
            
        except Exception as e:
            raise Exception(f"Failed to save PDF: {str(e)}")
    
    async def _create_simple_pdf(self, latex_content: str, filename: str) -> str:
        """Fallback: Create a simple PDF with LaTeX content preview"""
        try:
            from reportlab.pdfgen import canvas
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
            
            temp_pdf_path = self.temp_dir / f"{filename}_fallback.pdf"
            
            # Create a more informative fallback PDF
            doc = SimpleDocTemplate(str(temp_pdf_path), pagesize=letter)
            styles = getSampleStyleSheet()
            
            story = []
            
            # Title
            title = Paragraph("PDF Generation Error", styles['Title'])
            story.append(title)
            story.append(Spacer(1, 12))
            
            # Error message
            error_msg = Paragraph("Unable to compile LaTeX document with online services.", styles['Normal'])
            story.append(error_msg)
            story.append(Spacer(1, 12))
            
            # LaTeX content preview
            latex_title = Paragraph("LaTeX content preview:", styles['Heading2'])
            story.append(latex_title)
            story.append(Spacer(1, 6))
            
            # Show first few lines of LaTeX
            lines = latex_content.split('\n')[:20]
            for line in lines:
                if line.strip():
                    line_para = Paragraph(line.replace('<', '&lt;').replace('>', '&gt;'), styles['Code'])
                    story.append(line_para)
            
            doc.build(story)
            
            logger.info(f"Created fallback PDF: {temp_pdf_path}")
            return str(temp_pdf_path)
            
        except ImportError:
            raise Exception("No PDF generation method available (install reportlab for fallback)")
        except Exception as e:
            raise Exception(f"Failed to create fallback PDF: {str(e)}")
    
    async def cleanup_temp_file(self, pdf_path: str):
        """Clean up a temporary PDF file"""
        try:
            pdf_file = Path(pdf_path)
            if pdf_file.exists():
                await asyncio.to_thread(pdf_file.unlink)
                logger.info(f"Cleaned up temp file: {pdf_path}")
        except Exception as e:
            logger.warning(f"Could not clean up temp file {pdf_path}: {e}")

# Initialize PDF generator service
try:
    result = subprocess.run(['pdflatex', '--version'], capture_output=True, check=True)
    pdf_generator = PDFGeneratorService()
    PDF_GENERATION_METHOD = "local"
    logger.info("Using local pdflatex for PDF generation")
except (subprocess.CalledProcessError, FileNotFoundError):
    pdf_generator = OnlinePDFGeneratorService()
    PDF_GENERATION_METHOD = "online"
    logger.info("Using online PDF generation services")
