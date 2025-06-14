# app/core/claude.py - Fixed for latest Anthropic API
import anthropic
import asyncio
from app.config import get_settings
from typing import List
from app.models.resume import ResumeSections
import logging

logger = logging.getLogger(__name__)

class ClaudeService:
    def __init__(self):
        settings = get_settings()
        # Initialize the Anthropic client correctly
        self.client = anthropic.Anthropic(api_key=settings.claude_api_key)
    
    async def customize_resume(
        self, 
        latex_content: str, 
        job_description: str, 
        sections_to_modify: List[ResumeSections],
        modification_percentage: int
    ) -> str:
        """
        Customize resume using Claude API
        """
        sections_str = ", ".join([section.value for section in sections_to_modify])
        
        prompt = self._build_customization_prompt(
            latex_content,
            job_description,
            sections_str,
            modification_percentage
        )
        
        try:
            logger.info("Making Claude API call...")
            # Run the Claude API call in a thread to avoid blocking
            response = await asyncio.to_thread(
                self._call_claude_api,
                prompt
            )
            
            logger.info(f"Claude API response received. Length: {len(response.content[0].text)}")
            
            # Extract LaTeX code from response
            customized_latex = self._extract_latex_from_response(response.content[0].text)
            return customized_latex
            
        except Exception as e:
            logger.error(f"Claude API error details: {str(e)}")
            raise Exception(f"Claude API error: {str(e)}")
    
    def _call_claude_api(self, prompt: str):
        """Synchronous Claude API call with correct method"""
        try:
            # Use the correct API method - it should be 'messages' but let's check available methods
            logger.info(f"Available Claude client methods: {dir(self.client)}")
            
            # Try the standard messages.create method
            return self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=4000,
                temperature=0.7,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
        except AttributeError as e:
            logger.error(f"Claude API method not found: {e}")
            # Try alternative method if messages doesn't exist
            try:
                # Some versions might use 'completions' instead
                return self.client.completions.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=4000,
                    temperature=0.7,
                    prompt=prompt
                )
            except Exception as alt_error:
                logger.error(f"Alternative Claude API method failed: {alt_error}")
                raise Exception(f"Claude API method not available. Original error: {e}")
        except Exception as e:
            logger.error(f"Claude API call failed: {e}")
            raise e
    
    def _build_customization_prompt(
        self, 
        latex_content: str, 
        job_description: str, 
        sections: str, 
        percentage: int
    ) -> str:
        """Build the prompt for Claude"""
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

    def _extract_latex_from_response(self, response_text: str) -> str:
        """Extract and clean LaTeX code from Claude's response"""
        # Remove any markdown code blocks if present
        if "```latex" in response_text:
            start = response_text.find("```latex") + 8
            end = response_text.find("```", start)
            return response_text[start:end].strip()
        elif "```" in response_text:
            start = response_text.find("```") + 3
            end = response_text.find("```", start)
            return response_text[start:end].strip()
        
        # If no code blocks, return the entire response
        return response_text.strip()

# Initialize Claude service
claude_service = ClaudeService()
