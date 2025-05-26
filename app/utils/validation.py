# app/utils/validation.py
import re
from typing import List

def validate_latex_content(latex_content: str) -> bool:
    """
    Validate basic LaTeX document structure
    """
    if not latex_content or not isinstance(latex_content, str):
        return False
    
    # Check for basic LaTeX document structure
    required_elements = [
        r'\\documentclass',
        r'\\begin{document}',
        r'\\end{document}'
    ]
    
    for element in required_elements:
        if not re.search(element, latex_content):
            return False
    
    # Check for balanced braces (basic check)
    open_braces = latex_content.count('{')
    close_braces = latex_content.count('}')
    
    if open_braces != close_braces:
        return False
    
    # Check for common LaTeX errors
    error_patterns = [
        r'\\end{document}.*\\begin{document}',  # document blocks in wrong order
        r'\\documentclass.*\\documentclass',     # multiple documentclass declarations
    ]
    
    for pattern in error_patterns:
        if re.search(pattern, latex_content):
            return False
    
    return True

def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename for safe file operations
    """
    # Remove or replace unsafe characters
    unsafe_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*']
    for char in unsafe_chars:
        filename = filename.replace(char, '_')
    
    # Remove leading/trailing spaces and dots
    filename = filename.strip('. ')
    
    # Ensure filename is not empty
    if not filename:
        filename = "untitled"
    
    return filename
