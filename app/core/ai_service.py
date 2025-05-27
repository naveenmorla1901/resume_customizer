# app/core/ai_service.py - Fixed with better error handling and compatibility
import asyncio
import logging
from abc import ABC, abstractmethod
from typing import List, Optional
import json
from app.config import get_settings
from app.models.resume import ResumeSections

logger = logging.getLogger(__name__)

class AIProvider(ABC):
    """Abstract base class for AI providers"""
    
    @abstractmethod
    async def customize_resume(
        self, 
        latex_content: str, 
        job_description: str, 
        sections_to_modify: List[ResumeSections],
        modification_percentage: int
    ) -> str:
        pass
    
    @abstractmethod
    def get_provider_name(self) -> str:
        pass

class ClaudeProvider(AIProvider):
    """Claude AI provider with better error handling"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = None
        self.model = "claude-3-5-sonnet-20241022"
        
        try:
            import anthropic
            
            # Try to create the client with proper error handling
            self.client = anthropic.Anthropic(api_key=api_key)
            
            # Test the client with a simple call
            logger.info("Claude provider initialized successfully")
            
        except ImportError as e:
            logger.error(f"Anthropic package not installed: {e}")
            raise Exception(f"Anthropic package not available: {str(e)}")
        except Exception as e:
            logger.error(f"Failed to initialize Claude: {e}")
            # Instead of raising, set client to None so provider is marked as unavailable
            self.client = None
            raise Exception(f"Claude initialization failed: {str(e)}")
            
    def is_available(self) -> bool:
        """Check if Claude provider is available"""
        return self.client is not None
    
    async def customize_resume(
        self, 
        latex_content: str, 
        job_description: str, 
        sections_to_modify: List[ResumeSections],
        modification_percentage: int
    ) -> str:
        if not self.is_available():
            raise Exception("Claude provider is not available")
            
        sections_str = ", ".join([section.value for section in sections_to_modify])
        prompt = self._build_prompt(latex_content, job_description, sections_str, modification_percentage)
        
        try:
            response = await asyncio.to_thread(
                self._call_claude_api,
                prompt
            )
            
            return self._extract_latex(response.content[0].text)
        except Exception as e:
            logger.error(f"Claude API call failed: {e}")
            raise Exception(f"Claude API error: {str(e)}")
    
    def _call_claude_api(self, prompt: str):
        """Synchronous Claude API call"""
        try:
            return self.client.messages.create(
                model=self.model,
                max_tokens=4000,
                temperature=0.7,
                messages=[{"role": "user", "content": prompt}]
            )
                
        except Exception as e:
            logger.error(f"Claude API call error: {e}")
            raise e
    
    def get_provider_name(self) -> str:
        return "Claude Sonnet 3.5"
    
    def _build_prompt(self, latex_content: str, job_description: str, sections: str, percentage: int) -> str:
        return f"""Here is a resume in LaTeX format and a job description. 

RESUME (LaTeX):
{latex_content}

JOB DESCRIPTION:
{job_description}

INSTRUCTIONS:
- Customize mainly these sections: {sections}
- Modify the resume to match the job description by approximately {percentage}%
- Keep the resume length and overall structure similar
- Focus on making the content more relevant to the specified job
- Maintain the LaTeX formatting and document structure
- Only modify content within the specified sections
- Ensure all LaTeX syntax remains valid

OUTPUT REQUIREMENTS:
- Return ONLY the updated LaTeX code
- Do not include any explanations, comments, or additional text
- Start directly with the LaTeX document code

UPDATED LATEX CODE:"""
    
    def _extract_latex(self, response_text: str) -> str:
        if "```latex" in response_text:
            start = response_text.find("```latex") + 8
            end = response_text.find("```", start)
            return response_text[start:end].strip()
        elif "```" in response_text:
            start = response_text.find("```") + 3
            end = response_text.find("```", start)
            return response_text[start:end].strip()
        return response_text.strip()

class GeminiProvider(AIProvider):
    """Google Gemini AI provider"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model = "gemini-2.0-flash-exp"
        self.endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"
        logger.info("Gemini provider initialized successfully")
        
    def is_available(self) -> bool:
        """Check if Gemini provider is available"""
        return bool(self.api_key)
    
    async def customize_resume(
        self, 
        latex_content: str, 
        job_description: str, 
        sections_to_modify: List[ResumeSections],
        modification_percentage: int
    ) -> str:
        sections_str = ", ".join([section.value for section in sections_to_modify])
        prompt = self._build_prompt(latex_content, job_description, sections_str, modification_percentage)
        
        try:
            import aiohttp
            
            headers = {
                "Content-Type": "application/json",
            }
            
            payload = {
                "contents": [{
                    "parts": [{
                        "text": prompt
                    }]
                }],
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 4000,
                }
            }
            
            url = f"{self.endpoint}?key={self.api_key}"
            
            timeout = aiohttp.ClientTimeout(total=60)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(url, headers=headers, json=payload) as response:
                    if response.status == 200:
                        result = await response.json()
                        
                        if 'candidates' in result and len(result['candidates']) > 0:
                            text = result['candidates'][0]['content']['parts'][0]['text']
                            return self._extract_latex(text)
                        else:
                            raise Exception("No valid response from Gemini API")
                    else:
                        error_text = await response.text()
                        raise Exception(f"Gemini API error (HTTP {response.status}): {error_text}")
                        
        except Exception as e:
            logger.error(f"Gemini API call failed: {e}")
            raise Exception(f"Gemini API error: {str(e)}")
    
    def get_provider_name(self) -> str:
        return "Google Gemini 2.0 Flash"
    
    def _build_prompt(self, latex_content: str, job_description: str, sections: str, percentage: int) -> str:
        return f"""You are a resume customization expert. Customize the following LaTeX resume for a specific job.

RESUME (LaTeX):
{latex_content}

JOB DESCRIPTION:
{job_description}

CUSTOMIZATION REQUIREMENTS:
- Focus on these sections: {sections}
- Modification level: {percentage}% of the content
- Keep the same LaTeX structure and formatting
- Make content more relevant to the job description
- Maintain professional tone and accuracy
- Preserve all LaTeX commands and document structure

Return ONLY the complete updated LaTeX code without any explanations or markdown formatting."""
    
    def _extract_latex(self, response_text: str) -> str:
        if "```latex" in response_text:
            start = response_text.find("```latex") + 8
            end = response_text.find("```", start)
            return response_text[start:end].strip()
        elif "```" in response_text:
            start = response_text.find("```") + 3
            end = response_text.find("```", start)
            return response_text[start:end].strip()
        return response_text.strip()

class DeepSeekProvider(AIProvider):
    """DeepSeek AI provider using OpenAI-compatible API"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model = "deepseek-chat"
        self.endpoint = "https://api.deepseek.com/chat/completions"
        
        # Validate API key format
        if not api_key or not api_key.startswith('sk-'):
            logger.warning(f"DeepSeek API key format may be incorrect. Expected format: sk-... but got: {api_key[:10] if api_key else 'None'}...")
        
        logger.info(f"DeepSeek provider initialized - endpoint: {self.endpoint}")
        logger.info(f"DeepSeek API key format: {'Valid (sk-...)' if api_key and api_key.startswith('sk-') else 'Invalid format'}")
        
    def is_available(self) -> bool:
        """Check if DeepSeek provider is available"""
        return bool(self.api_key)
    
    async def customize_resume(
        self, 
        latex_content: str, 
        job_description: str, 
        sections_to_modify: List[ResumeSections],
        modification_percentage: int
    ) -> str:
        sections_str = ", ".join([section.value for section in sections_to_modify])
        prompt = self._build_prompt(latex_content, job_description, sections_str, modification_percentage)
        
        logger.info(f"DeepSeek API call starting - URL: {self.endpoint}")
        logger.info(f"DeepSeek model: {self.model}")
        logger.info(f"Prompt length: {len(prompt)} characters")
        
        try:
            import aiohttp
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}"
            }
            
            # DeepSeek uses OpenAI-compatible format
            payload = {
                "model": self.model,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.7,
                "max_tokens": 4000,
                "stream": False
            }
            
            logger.info(f"DeepSeek request payload keys: {list(payload.keys())}")
            
            timeout = aiohttp.ClientTimeout(total=60)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                logger.info("Making DeepSeek API request...")
                async with session.post(self.endpoint, headers=headers, json=payload) as response:
                    logger.info(f"DeepSeek API response status: {response.status}")
                    
                    # Read response text first for debugging
                    response_text = await response.text()
                    logger.info(f"DeepSeek API response length: {len(response_text)} characters")
                    
                    if response.status == 200:
                        try:
                            result = await response.json()
                            logger.info(f"DeepSeek API response structure: {list(result.keys()) if isinstance(result, dict) else type(result)}")
                            
                            if 'choices' in result and len(result['choices']) > 0:
                                choice = result['choices'][0]
                                logger.info(f"Choice structure: {list(choice.keys()) if isinstance(choice, dict) else type(choice)}")
                                
                                message = choice.get('message', {})
                                content = message.get('content', '')
                                
                                if content:
                                    logger.info(f"DeepSeek API returned content length: {len(content)} characters")
                                    return self._extract_latex(content)
                                else:
                                    logger.error(f"No content in DeepSeek response message: {message}")
                                    raise Exception(f"No content in DeepSeek response. Message: {message}")
                            else:
                                logger.error(f"Invalid DeepSeek response format - no choices: {result}")
                                raise Exception(f"Invalid DeepSeek response format: {result}")
                                
                        except ValueError as json_error:
                            logger.error(f"DeepSeek API returned invalid JSON: {json_error}")
                            logger.error(f"Raw response: {response_text[:500]}...")
                            raise Exception(f"DeepSeek API returned invalid JSON: {json_error}")
                            
                    else:
                        logger.error(f"DeepSeek API error (HTTP {response.status})")
                        logger.error(f"Response headers: {dict(response.headers)}")
                        logger.error(f"Response body: {response_text}")
                        
                        # Try to parse error details
                        try:
                            error_data = await response.json()
                            logger.error(f"DeepSeek error data: {error_data}")
                            error_message = error_data.get('error', {}).get('message', response_text)
                        except:
                            error_message = response_text
                            
                        raise Exception(f"DeepSeek API error (HTTP {response.status}): {error_message}")
                        
        except aiohttp.ClientError as client_error:
            logger.error(f"DeepSeek HTTP client error: {client_error}")
            raise Exception(f"DeepSeek HTTP client error: {str(client_error)}")
        except Exception as e:
            logger.error(f"DeepSeek API call failed with exception: {e}")
            logger.error(f"Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            raise Exception(f"DeepSeek API error: {str(e)}")
    
    def get_provider_name(self) -> str:
        return "DeepSeek Chat"
    
    def _build_prompt(self, latex_content: str, job_description: str, sections: str, percentage: int) -> str:
        return f"""Customize this LaTeX resume to better match the job description.

ORIGINAL RESUME:
{latex_content}

JOB DESCRIPTION:
{job_description}

INSTRUCTIONS:
- Modify primarily these sections: {sections}
- Adjustment level: {percentage}% of content should be changed
- Keep LaTeX formatting intact
- Ensure all commands and structure remain valid
- Focus on making content more relevant to the job
- Maintain professional language

Output only the complete modified LaTeX code."""
    
    def _extract_latex(self, response_text: str) -> str:
        if "```latex" in response_text:
            start = response_text.find("```latex") + 8
            end = response_text.find("```", start)
            return response_text[start:end].strip()
        elif "```" in response_text:
            start = response_text.find("```") + 3
            end = response_text.find("```", start)
            return response_text[start:end].strip()
        return response_text.strip()

class AIService:
    """Main AI service that manages multiple providers"""
    
    def __init__(self):
        self.settings = get_settings()
        self.providers = {}
        self._initialize_providers()
    
    def _initialize_providers(self):
        """Initialize available AI providers based on API keys with better error handling"""
        
        # Initialize providers dictionary
        self.providers = {}
        
        # Try Claude with better error handling (don't fail if it has compatibility issues)
        if self.settings.claude_api_key:
            try:
                claude_provider = ClaudeProvider(self.settings.claude_api_key)
                if claude_provider.is_available():
                    self.providers['claude'] = claude_provider
                    logger.info("✅ Claude provider initialized")
                else:
                    logger.warning("⚠️ Claude provider not available")
            except Exception as e:
                logger.warning(f"⚠️ Claude provider skipped due to compatibility issues: {e}")
                logger.info("ℹ️ Claude will not be available as an option")
        else:
            logger.info("ℹ️ Claude API key not provided")
        
        # Try Gemini
        if self.settings.gemini_api_key:
            try:
                gemini_provider = GeminiProvider(self.settings.gemini_api_key)
                if gemini_provider.is_available():
                    self.providers['gemini'] = gemini_provider
                    logger.info("✅ Gemini provider initialized")
                else:
                    logger.warning("⚠️ Gemini provider not available")
            except Exception as e:
                logger.warning(f"❌ Failed to initialize Gemini provider: {e}")
        else:
            logger.info("ℹ️ Gemini API key not provided")
        
        # Try DeepSeek
        if self.settings.deepseek_api_key:
            try:
                deepseek_provider = DeepSeekProvider(self.settings.deepseek_api_key)
                if deepseek_provider.is_available():
                    self.providers['deepseek'] = deepseek_provider
                    logger.info("✅ DeepSeek provider initialized")
                else:
                    logger.warning("⚠️ DeepSeek provider not available")
            except Exception as e:
                logger.warning(f"❌ Failed to initialize DeepSeek provider: {e}")
        else:
            logger.info("ℹ️ DeepSeek API key not provided")
        
        # Summary
        if not self.providers:
            logger.error("❌ No AI providers initialized! Check your API keys.")
            logger.error("ℹ️ At least one of CLAUDE_API_KEY, GEMINI_API_KEY, or DEEPSEEK_API_KEY must be set")
        else:
            logger.info(f"✅ Initialized AI providers: {list(self.providers.keys())}")
    
    def get_available_providers(self) -> dict:
        """Get list of available providers"""
        return {
            provider_id: provider.get_provider_name() 
            for provider_id, provider in self.providers.items()
        }
    
    async def customize_resume(
        self, 
        provider_id: str,
        latex_content: str, 
        job_description: str, 
        sections_to_modify: List[ResumeSections],
        modification_percentage: int
    ) -> str:
        """Customize resume using specified provider"""
        if provider_id not in self.providers:
            available = list(self.providers.keys())
            logger.error(f"Provider '{provider_id}' not available. Available: {available}")
            raise Exception(f"Provider '{provider_id}' not available. Available providers: {available}")
        
        provider = self.providers[provider_id]
        logger.info(f"Using {provider.get_provider_name()} for resume customization")
        
        try:
            result = await provider.customize_resume(
                latex_content, 
                job_description, 
                sections_to_modify, 
                modification_percentage
            )
            logger.info(f"✅ Resume customization completed with {provider.get_provider_name()}")
            return result
        except Exception as e:
            logger.error(f"❌ Resume customization failed with {provider.get_provider_name()}: {e}")
            raise e

# Initialize global AI service
ai_service = AIService()
