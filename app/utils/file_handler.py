# app/utils/file_handler.py
import os
import shutil
from pathlib import Path
from typing import Optional
from app.utils.validation import sanitize_filename

class FileHandler:
    """Handle file operations for the application"""
    
    def __init__(self, base_dir: str = "temp_files"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(exist_ok=True)
    
    def save_temp_file(self, content: str, filename: str, extension: str = ".tex") -> str:
        """Save content to a temporary file"""
        safe_filename = sanitize_filename(filename)
        file_path = self.base_dir / f"{safe_filename}{extension}"
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return str(file_path)
    
    def read_file(self, file_path: str) -> str:
        """Read content from a file"""
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def delete_file(self, file_path: str) -> bool:
        """Delete a file"""
        try:
            os.remove(file_path)
            return True
        except (OSError, FileNotFoundError):
            return False
    
    def cleanup_old_files(self, max_age_hours: int = 24):
        """Clean up files older than specified hours"""
        import time
        current_time = time.time()
        cutoff_time = current_time - (max_age_hours * 3600)
        
        for file_path in self.base_dir.glob("*"):
            if file_path.is_file():
                file_age = os.path.getmtime(file_path)
                if file_age < cutoff_time:
                    try:
                        os.remove(file_path)
                    except OSError:
                        pass  # Ignore errors when deleting

# Create global file handler instance
file_handler = FileHandler()
