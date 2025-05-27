#!/usr/bin/env python3
"""
DeepSeek API Direct Test
This script tests the DeepSeek API directly to identify issues
"""

import asyncio
import aiohttp
import logging
import os
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

load_dotenv()

async def test_deepseek_api():
    """Test DeepSeek API directly"""
    
    api_key = os.getenv('DEEPSEEK_API_KEY')
    
    if not api_key:
        logger.error("❌ DEEPSEEK_API_KEY not found in environment")
        return False
    
    logger.info(f"🔑 API Key format: {api_key[:10]}... (length: {len(api_key)})")
    logger.info(f"🔑 Starts with 'sk-': {api_key.startswith('sk-')}")
    
    endpoint = "https://api.deepseek.com/chat/completions"
    logger.info(f"🌐 Endpoint: {endpoint}")
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    payload = {
        "model": "deepseek-chat",
        "messages": [
            {
                "role": "user",
                "content": "Hello, please respond with 'DeepSeek API is working correctly.'"
            }
        ],
        "temperature": 0.7,
        "max_tokens": 100,
        "stream": False
    }
    
    logger.info(f"📤 Request payload: {payload}")
    
    try:
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            logger.info("🚀 Making API request...")
            
            async with session.post(endpoint, headers=headers, json=payload) as response:
                logger.info(f"📥 Response status: {response.status}")
                logger.info(f"📥 Response headers: {dict(response.headers)}")
                
                response_text = await response.text()
                logger.info(f"📥 Response length: {len(response_text)} characters")
                
                if response.status == 200:
                    try:
                        result = await response.json()
                        logger.info(f"✅ JSON parsed successfully")
                        logger.info(f"📋 Response keys: {list(result.keys())}")
                        
                        if 'choices' in result and len(result['choices']) > 0:
                            choice = result['choices'][0]
                            logger.info(f"📋 Choice keys: {list(choice.keys())}")
                            
                            if 'message' in choice:
                                message = choice['message']
                                logger.info(f"📋 Message keys: {list(message.keys())}")
                                
                                if 'content' in message:
                                    content = message['content']
                                    logger.info(f"✅ SUCCESS! Content: {content}")
                                    return True
                                else:
                                    logger.error(f"❌ No 'content' in message: {message}")
                            else:
                                logger.error(f"❌ No 'message' in choice: {choice}")
                        else:
                            logger.error(f"❌ No 'choices' in result: {result}")
                            
                    except Exception as json_error:
                        logger.error(f"❌ JSON parsing failed: {json_error}")
                        logger.error(f"Raw response: {response_text}")
                        
                else:
                    logger.error(f"❌ HTTP Error {response.status}")
                    logger.error(f"Response body: {response_text}")
                    
                    # Try to parse error response
                    try:
                        error_data = await response.json()
                        logger.error(f"Error details: {error_data}")
                    except:
                        logger.error("Could not parse error response as JSON")
                        
                return False
                
    except aiohttp.ClientError as e:
        logger.error(f"❌ HTTP Client Error: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return False

async def test_deepseek_models():
    """Test different DeepSeek models"""
    
    api_key = os.getenv('DEEPSEEK_API_KEY')
    if not api_key:
        return False
    
    models_to_test = ["deepseek-chat", "deepseek-reasoner"]
    
    for model in models_to_test:
        logger.info(f"\n🧪 Testing model: {model}")
        
        endpoint = "https://api.deepseek.com/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": "Say 'test'"}],
            "max_tokens": 10
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(endpoint, headers=headers, json=payload) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"✅ {model} works")
                    else:
                        error_text = await response.text()
                        logger.warning(f"⚠️ {model} failed: {response.status} - {error_text[:100]}...")
        except Exception as e:
            logger.warning(f"⚠️ {model} error: {e}")

async def main():
    logger.info("🚀 DeepSeek API Direct Test")
    logger.info("=" * 50)
    
    # Test main API
    success = await test_deepseek_api()
    
    # Test different models
    await test_deepseek_models()
    
    logger.info("\n" + "=" * 50)
    if success:
        logger.info("🎉 DeepSeek API test PASSED")
        logger.info("The issue might be in the Resume Customizer implementation")
    else:
        logger.error("❌ DeepSeek API test FAILED")
        logger.error("Check your API key and account status")
        logger.info("\n🔧 Troubleshooting steps:")
        logger.info("1. Verify API key at https://platform.deepseek.com/api_keys")
        logger.info("2. Check account balance/credits")
        logger.info("3. Ensure API key format: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
        logger.info("4. Try creating a new API key")
    
    return success

if __name__ == "__main__":
    result = asyncio.run(main())
    exit(0 if result else 1)