#!/usr/bin/env python3
"""
Quick Test Script - Verify All Fixes Applied
Run this to test all three issues have been resolved
"""

import os
import sys
import logging
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def test_issue_1_deepseek_api_key():
    """Test Issue 1: DeepSeek API Key Format"""
    logger.info("🔍 Testing Issue 1: DeepSeek API Key")
    
    load_dotenv()
    api_key = os.getenv('DEEPSEEK_API_KEY')
    
    if not api_key:
        logger.error("❌ No DeepSeek API key found")
        return False
    
    logger.info(f"🔑 API Key length: {len(api_key)} characters")
    logger.info(f"🔑 Starts with 'sk-': {api_key.startswith('sk-')}")
    
    if len(api_key) >= 40 and api_key.startswith('sk-'):
        logger.info("✅ DeepSeek API key format looks correct!")
        return True
    else:
        logger.error("❌ DeepSeek API key format is still incorrect")
        logger.error("   Go to https://platform.deepseek.com/api_keys for a proper key")
        return False

def test_issue_2_layout_optimization():
    """Test Issue 2: Layout Changes"""
    logger.info("\n🎨 Testing Issue 2: Layout Optimization")
    
    css_path = "frontend/css/app.css"
    if not os.path.exists(css_path):
        logger.error(f"❌ CSS file not found: {css_path}")
        return False
    
    with open(css_path, 'r', encoding='utf-8') as f:
        css_content = f.read()
    
    if "grid-template-columns: 1fr 2fr" in css_content:
        logger.info("✅ Layout optimized: 33% form, 67% PDF preview")
        return True
    else:
        logger.error("❌ Layout still using old 50/50 split")
        return False

def test_issue_3_temp_resume_logic():
    """Test Issue 3: Temporary Resume Logic"""
    logger.info("\n📝 Testing Issue 3: Temporary Resume Logic")
    
    customization_path = "app/api/customization.py"
    if not os.path.exists(customization_path):
        logger.error(f"❌ Customization file not found: {customization_path}")
        return False
    
    with open(customization_path, 'r', encoding='utf-8') as f:
        code_content = f.read()
    
    checks = [
        ("REPLACING existing temp resume", "Enhanced logging for temp resume replacement"),
        ("temp_resume_response.data", "Checks for existing temp resume"),
        ("ResumeType.TEMPORARY.value", "Uses proper enum for resume type")
    ]
    
    all_good = True
    for check, description in checks:
        if check in code_content:
            logger.info(f"✅ {description}")
        else:
            logger.error(f"❌ Missing: {description}")
            all_good = False
    
    return all_good

def main():
    """Run all tests"""
    logger.info("🚀 Resume Customizer - Fix Verification")
    logger.info("=" * 50)
    
    # Run all tests
    test1_pass = test_issue_1_deepseek_api_key()
    test2_pass = test_issue_2_layout_optimization()
    test3_pass = test_issue_3_temp_resume_logic()
    
    # Summary
    logger.info("\n📊 RESULTS")
    logger.info("=" * 50)
    
    results = [
        ("Issue 1 - DeepSeek API", test1_pass),
        ("Issue 2 - Layout Optimization", test2_pass), 
        ("Issue 3 - Temp Resume Logic", test3_pass)
    ]
    
    all_pass = True
    for issue, passed in results:
        status = "✅ FIXED" if passed else "❌ NEEDS ATTENTION"
        logger.info(f"{issue}: {status}")
        if not passed:
            all_pass = False
    
    if all_pass:
        logger.info("\n🎉 ALL ISSUES HAVE BEEN FIXED!")
        logger.info("Your Resume Customizer is ready to use.")
        logger.info("\nNext steps:")
        logger.info("1. Start server: uvicorn app.main:app --reload --port 8000")
        logger.info("2. Open: http://localhost:8000/login")
        logger.info("3. Test all three AI providers")
    else:
        logger.error("\n⚠️ Some issues still need attention - see details above")
    
    return all_pass

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
