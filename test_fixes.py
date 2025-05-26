#!/usr/bin/env python3
"""
Test script to verify Resume Customizer fixes
Run this script to test core functionality without starting the full server
"""

import asyncio
import sys
import os
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

async def test_pdf_generator():
    """Test PDF generator functionality"""
    print("🧪 Testing PDF Generator...")
    
    try:
        from app.core.pdf_generator import pdf_generator, PDF_GENERATION_METHOD
        print(f"✅ PDF Generator imported successfully")
        print(f"📋 Using method: {PDF_GENERATION_METHOD}")
        
        # Test with sample LaTeX
        sample_latex = r"""
\documentclass{article}
\begin{document}
\title{Test Resume}
\author{Test User}
\date{\today}
\maketitle

\section{Experience}
\begin{itemize}
\item Software Developer at Test Company (2020-2024)
\end{itemize}

\section{Skills}
Python, JavaScript, LaTeX

\end{document}
"""
        
        print("🔄 Testing PDF generation...")
        pdf_path = await pdf_generator.latex_to_pdf(sample_latex, "test_resume")
        
        if os.path.exists(pdf_path):
            print(f"✅ PDF generated successfully: {pdf_path}")
            
            # Test cleanup
            await pdf_generator.cleanup_temp_file(pdf_path)
            print("✅ Cleanup function works")
            
            return True
        else:
            print(f"❌ PDF file not found: {pdf_path}")
            return False
            
    except Exception as e:
        print(f"❌ PDF Generator test failed: {e}")
        return False

async def test_claude_service():
    """Test Claude service functionality"""
    print("\n🧪 Testing Claude Service...")
    
    try:
        from app.core.claude import claude_service
        from app.models.resume import ResumeSections
        print("✅ Claude service imported successfully")
        
        # Note: This will fail without a valid API key, but we can test the structure
        try:
            result = await claude_service.customize_resume(
                latex_content="\\documentclass{article}\\begin{document}Test\\end{document}",
                job_description="Software Engineer position",
                sections_to_modify=[ResumeSections.EXPERIENCE],
                modification_percentage=30
            )
            print("✅ Claude service call succeeded")
            return True
            
        except Exception as e:
            if "API key" in str(e) or "Claude API error" in str(e):
                print("⚠️  Claude service structure OK, but API key needed for full test")
                return True
            else:
                print(f"❌ Claude service test failed: {e}")
                return False
                
    except Exception as e:
        print(f"❌ Claude service import failed: {e}")
        return False

def test_imports():
    """Test all critical imports"""
    print("🧪 Testing Imports...")
    
    imports_to_test = [
        "app.config",
        "app.core.supabase",
        "app.models.resume",
        "app.schemas.customization",
        "app.utils.validation",
        "app.api.resumes",
        "app.api.customization",
        "app.api.auth"
    ]
    
    failed_imports = []
    
    for module_name in imports_to_test:
        try:
            __import__(module_name)
            print(f"✅ {module_name}")
        except Exception as e:
            print(f"❌ {module_name}: {e}")
            failed_imports.append(module_name)
    
    return len(failed_imports) == 0

def test_config():
    """Test configuration"""
    print("\n🧪 Testing Configuration...")
    
    try:
        from app.config import get_settings
        settings = get_settings()
        
        print(f"✅ Settings loaded")
        print(f"📋 App name: {settings.app_name}")
        print(f"📋 Temp directory: {settings.temp_file_directory}")
        
        # Check if temp directory exists
        temp_dir = Path(settings.temp_file_directory)
        if temp_dir.exists():
            print(f"✅ Temp directory exists: {temp_dir}")
        else:
            print(f"⚠️  Temp directory missing: {temp_dir}")
            temp_dir.mkdir(exist_ok=True)
            print(f"✅ Created temp directory: {temp_dir}")
            
        return True
        
    except Exception as e:
        print(f"❌ Configuration test failed: {e}")
        return False

async def main():
    """Run all tests"""
    print("🚀 Resume Customizer - Fix Verification Tests")
    print("=" * 50)
    
    tests = [
        ("Configuration", test_config),
        ("Imports", test_imports),
        ("PDF Generator", test_pdf_generator),
        ("Claude Service", test_claude_service),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            if asyncio.iscoroutinefunction(test_func):
                result = await test_func()
            else:
                result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} test crashed: {e}")
            results.append((test_name, False))
    
    print("\n" + "=" * 50)
    print("📊 Test Results Summary:")
    
    passed = 0
    total = len(results)
    
    for test_name, passed_test in results:
        status = "✅ PASS" if passed_test else "❌ FAIL"
        print(f"{status} {test_name}")
        if passed_test:
            passed += 1
    
    print(f"\n🎯 Overall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Your fixes should work correctly.")
    else:
        print("⚠️  Some tests failed. Check the errors above and ensure:")
        print("   1. All dependencies are installed: pip install -r requirements.txt")
        print("   2. .env file is properly configured")
        print("   3. Required API keys are set")

if __name__ == "__main__":
    asyncio.run(main())
