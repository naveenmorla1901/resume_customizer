#!/usr/bin/env python3
"""
Quick Provider Test Script
Tests the AI provider initialization and API endpoint
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add the project root to Python path
sys.path.insert(0, str(Path.cwd()))

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

async def test_providers():
    """Test AI provider initialization"""
    
    logger.info("🤖 Testing AI Provider Initialization...")
    
    try:
        # Import the AI service
        from app.core.ai_service import ai_service
        
        # Get available providers
        providers = ai_service.get_available_providers()
        
        logger.info(f"📋 Available providers: {providers}")
        
        if not providers:
            logger.error("❌ No providers available!")
            return False
        
        # Test each provider
        for provider_id, provider_name in providers.items():
            logger.info(f"✅ {provider_name} ({provider_id}) is available")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Provider test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_api_endpoint():
    """Test the providers API endpoint"""
    
    logger.info("\n🌐 Testing Providers API Endpoint...")
    
    try:
        from app.api.customization import get_available_providers
        
        # Call the endpoint function directly
        response = await get_available_providers()
        
        logger.info(f"📋 API Response: {response}")
        
        if hasattr(response, 'available_providers'):
            logger.info(f"✅ Available providers: {response.available_providers}")
            logger.info(f"✅ Default provider: {response.default_provider}")
            return True
        else:
            logger.error("❌ Invalid API response format")
            return False
            
    except Exception as e:
        logger.error(f"❌ API endpoint test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_claude_direct():
    """Test Claude provider directly"""
    
    logger.info("\n🔮 Testing Claude Provider Directly...")
    
    try:
        from app.config import get_settings
        
        settings = get_settings() 
        
        if not settings.claude_api_key:
            logger.warning("⚠️ No Claude API key configured")
            return True
        
        # Try to create Claude client
        import anthropic
        client = anthropic.Anthropic(api_key=settings.claude_api_key)
        logger.info("✅ Claude client created successfully")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Claude direct test failed: {e}")
        return False

async def main():
    """Main test function"""
    
    logger.info("🚀 Quick Provider Test")
    logger.info("=" * 50)
    
    # Test 1: Provider initialization
    provider_ok = await test_providers()
    
    # Test 2: API endpoint
    api_ok = await test_api_endpoint()
    
    # Test 3: Claude direct
    claude_ok = await test_claude_direct()
    
    # Summary
    logger.info("\n" + "=" * 50) 
    logger.info("📋 TEST SUMMARY")
    logger.info("=" * 50)
    
    logger.info(f"Provider Init: {'✅ PASS' if provider_ok else '❌ FAIL'}")
    logger.info(f"API Endpoint: {'✅ PASS' if api_ok else '❌ FAIL'}")
    logger.info(f"Claude Direct: {'✅ PASS' if claude_ok else '❌ FAIL'}")
    
    if all([provider_ok, api_ok, claude_ok]):
        logger.info("\n🎉 ALL TESTS PASSED!")
        logger.info("The providers should work correctly now.")
    else:
        logger.error("\n❌ SOME TESTS FAILED!")
        logger.error("Check the error messages above for details.")

if __name__ == "__main__":
    asyncio.run(main())
