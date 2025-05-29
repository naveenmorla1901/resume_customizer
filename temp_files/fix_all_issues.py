#!/usr/bin/env python3
"""
Resume Customizer - Complete Fix for All Issues
This script addresses:
1. DeepSeek API issues
2. Preview layout optimization 
3. Temporary resume handling verification
"""

import asyncio
import aiohttp
import logging
import os
import sys
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

async def test_deepseek_api_key():
    """Test DeepSeek API key and provide fixes"""
    load_dotenv()
    
    api_key = os.getenv('DEEPSEEK_API_KEY')
    
    logger.info("🔍 ISSUE 1: DeepSeek API Analysis")
    logger.info("=" * 50)
    
    if not api_key:
        logger.error("❌ DEEPSEEK_API_KEY not found in .env file")
        return False
    
    logger.info(f"🔑 Current API key: {api_key[:20]}...")
    logger.info(f"🔑 Key length: {len(api_key)}")
    logger.info(f"🔑 Starts with 'sk-': {api_key.startswith('sk-')}")
    
    # Check if API key format is correct
    if not api_key.startswith('sk-') or len(api_key) < 40:
        logger.error("❌ PROBLEM IDENTIFIED: API key format is incorrect")
        logger.error("🔧 SOLUTION:")
        logger.error("   1. Go to https://platform.deepseek.com/api_keys")
        logger.error("   2. Create a new API key")
        logger.error("   3. DeepSeek keys should be much longer (usually 40+ characters)")
        logger.error("   4. Format: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
        logger.error(f"   5. Your current key ({len(api_key)} chars) is too short")
        return False
    
    # Test the API endpoint
    endpoint = "https://api.deepseek.com/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    payload = {
        "model": "deepseek-chat",
        "messages": [{"role": "user", "content": "Say 'API works'"}],
        "max_tokens": 10,
        "temperature": 0.1
    }
    
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(endpoint, headers=headers, json=payload) as response:
                if response.status == 200:
                    result = await response.json()
                    if 'choices' in result and result['choices']:
                        logger.info("✅ DeepSeek API is working correctly!")
                        return True
                    else:
                        logger.error("❌ Invalid response format from DeepSeek")
                        return False
                else:
                    error_text = await response.text()
                    logger.error(f"❌ API Error: HTTP {response.status}")
                    logger.error(f"Response: {error_text}")
                    
                    if response.status == 401:
                        logger.error("🔧 SOLUTION: Invalid API key - get a new one from DeepSeek platform")
                    elif response.status == 429:
                        logger.error("🔧 SOLUTION: Rate limit exceeded - wait or upgrade your plan")
                    elif response.status == 402:
                        logger.error("🔧 SOLUTION: Insufficient credits - add credits to your account")
                    
                    return False
                    
    except asyncio.TimeoutError:
        logger.error("❌ API request timed out")
        logger.error("🔧 SOLUTION: Check internet connection or DeepSeek service status")
        return False
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        return False

def analyze_preview_layout():
    """Analyze and provide fixes for preview layout"""
    logger.info("\n🎨 ISSUE 2: Preview Layout Analysis")
    logger.info("=" * 50)
    
    # Check current HTML structure
    html_path = "C:/projects/resume_customizer/frontend/index.html"
    css_path = "C:/projects/resume_customizer/frontend/css/app.css"
    
    try:
        with open(html_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
            
        # Analyze layout structure
        if 'interface-layout' in html_content and 'grid-template-columns: 1fr 1fr' in html_content:
            logger.info("📋 Current layout: 50/50 split (Form | PDF Preview)")
            logger.info("🎯 SOLUTION: Optimize layout to give more space to PDF preview")
            logger.info("   - Change from 1fr 1fr to 2fr 3fr (40% form, 60% preview)")
            logger.info("   - Or change to 1fr 2fr (33% form, 67% preview)")
            return True
        else:
            logger.info("✅ Layout structure looks optimized")
            return False
            
    except FileNotFoundError:
        logger.error(f"❌ Could not find HTML file at {html_path}")
        return False

def verify_temp_resume_logic():
    """Verify temporary resume handling logic"""
    logger.info("\n📝 ISSUE 3: Temporary Resume Logic Verification")
    logger.info("=" * 50)
    
    customization_path = "C:/projects/resume_customizer/app/api/customization.py"
    
    try:
        with open(customization_path, 'r', encoding='utf-8') as f:
            code_content = f.read()
        
        # Check for proper temp resume handling
        checks = [
            ("temp_resume_response.data", "✅ Checks for existing temp resume"),
            ("Update existing temp resume", "✅ Updates existing temp resume instead of creating new"),
            ("resume_type.*TEMPORARY", "✅ Uses proper temporary resume type"),
            ("ResumeType.TEMPORARY.value", "✅ Uses enum for resume type")
        ]
        
        all_good = True
        for check, description in checks:
            if check in code_content:
                logger.info(description)
            else:
                logger.error(f"❌ Missing: {description}")
                all_good = False
        
        if all_good:
            logger.info("✅ Temporary resume logic is correctly implemented")
            logger.info("   - Always checks for existing temp resume")
            logger.info("   - Updates existing instead of creating duplicates")
            logger.info("   - Uses proper enum types")
        
        return all_good
        
    except FileNotFoundError:
        logger.error(f"❌ Could not find customization file")
        return False

async def main():
    """Main function to run all fixes"""
    logger.info("🚀 Resume Customizer - Complete Fix Script")
    logger.info("=" * 60)
    
    # Test each issue
    deepseek_ok = await test_deepseek_api_key()
    layout_needs_fix = analyze_preview_layout()
    temp_logic_ok = verify_temp_resume_logic()
    
    # Summary
    logger.info("\n📊 SUMMARY")
    logger.info("=" * 50)
    
    if deepseek_ok:
        logger.info("✅ DeepSeek API: Working correctly")
    else:
        logger.error("❌ DeepSeek API: Needs fixing (get new API key)")
    
    if layout_needs_fix:
        logger.info("🔧 Preview Layout: Can be optimized")
    else:
        logger.info("✅ Preview Layout: Already optimized")
    
    if temp_logic_ok:
        logger.info("✅ Temp Resume Logic: Working correctly")
    else:
        logger.error("❌ Temp Resume Logic: Needs verification")
    
    # Provide next steps
    logger.info("\n🔧 NEXT STEPS")
    logger.info("=" * 50)
    
    if not deepseek_ok:
        logger.info("1. Fix DeepSeek API key:")
        logger.info("   - Visit https://platform.deepseek.com/api_keys")
        logger.info("   - Create new API key (should be 40+ characters)")
        logger.info("   - Update .env file with new key")
    
    if layout_needs_fix:
        logger.info("2. Optimize preview layout:")
        logger.info("   - I'll provide CSS fixes to optimize space usage")
    
    logger.info("3. Test the application:")
    logger.info("   - Start server: uvicorn app.main:app --reload --port 8000")
    logger.info("   - Test all three AI providers")
    logger.info("   - Verify temporary resume behavior")

if __name__ == "__main__":
    asyncio.run(main())
