#!/usr/bin/env python3
"""
Quick Claude API test to diagnose the issue
"""

import asyncio
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

async def test_claude_api():
    """Test Claude API directly"""
    print("🧪 Testing Claude API...")
    
    try:
        from app.config import get_settings
        settings = get_settings()
        
        print(f"Claude API Key present: {bool(settings.claude_api_key)}")
        print(f"API Key format: {settings.claude_api_key[:15]}..." if settings.claude_api_key else "No key")
        
        # Test import
        import anthropic
        print(f"Anthropic library version: {anthropic.__version__}")
        
        # Test client creation
        client = anthropic.Anthropic(api_key=settings.claude_api_key)
        print(f"Client created successfully")
        print(f"Available client attributes: {[attr for attr in dir(client) if not attr.startswith('_')]}")
        
        # Test if messages attribute exists
        if hasattr(client, 'messages'):
            print("✅ 'messages' attribute found")
            
            # Try a simple test call
            try:
                response = client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=100,
                    messages=[
                        {
                            "role": "user",
                            "content": "Say 'Hello, API is working!'"
                        }
                    ]
                )
                print(f"✅ API call successful: {response.content[0].text}")
                return True
                
            except Exception as api_error:
                print(f"❌ API call failed: {api_error}")
                return False
        else:
            print("❌ 'messages' attribute not found")
            print("Available methods:", [attr for attr in dir(client) if callable(getattr(client, attr)) and not attr.startswith('_')])
            return False
            
    except Exception as e:
        print(f"❌ Claude test failed: {e}")
        return False

async def test_pdf_generation():
    """Test PDF generation directly"""
    print("\n🧪 Testing PDF Generation...")
    
    try:
        from app.core.pdf_generator import pdf_generator
        
        simple_latex = r"""
\documentclass{article}
\begin{document}
\title{Test Resume}
\author{Test User}
\date{\today}
\maketitle

\section{Experience}
Software Developer at Test Company

\section{Skills}
Python, JavaScript

\end{document}
"""
        
        print("Generating PDF...")
        pdf_path = await pdf_generator.latex_to_pdf(simple_latex, "quick_test")
        
        if pdf_path:
            print(f"✅ PDF generated: {pdf_path}")
            
            # Check file size
            import os
            if os.path.exists(pdf_path):
                size = os.path.getsize(pdf_path)
                print(f"PDF size: {size} bytes")
                
                # Check if it's a valid PDF
                with open(pdf_path, 'rb') as f:
                    header = f.read(4)
                    if header == b'%PDF':
                        print("✅ Valid PDF file")
                        return True
                    else:
                        print(f"⚠️  Not a valid PDF (header: {header})")
                        return False
            else:
                print("❌ PDF file not found")
                return False
        else:
            print("❌ No PDF path returned")
            return False
            
    except Exception as e:
        print(f"❌ PDF test failed: {e}")
        return False

async def main():
    print("🚀 Quick Diagnostic Tests")
    print("=" * 40)
    
    claude_result = await test_claude_api()
    pdf_result = await test_pdf_generation()
    
    print("\n" + "=" * 40)
    print("📊 Results:")
    print(f"Claude API: {'✅ PASS' if claude_result else '❌ FAIL'}")
    print(f"PDF Generation: {'✅ PASS' if pdf_result else '❌ FAIL'}")
    
    if claude_result and pdf_result:
        print("\n🎉 Both components working! Try the application now.")
    else:
        print("\n⚠️  Some issues found. Check the errors above.")

if __name__ == "__main__":
    asyncio.run(main())
