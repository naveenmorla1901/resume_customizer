# app/core/claude.py
import anthropic
from app.config import get_settings
from typing import List
from app.models.resume import ResumeSections

class ClaudeService:
    def __init__(self):
        settings = get_settings()
        self.client = anthropic.Anthropic(api_key=settings.claude_api_key)
    
    def customize_resume(
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
            response = self.client.messages.create(
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
            
            # Extract LaTeX code from response
            customized_latex = self._extract_latex_from_response(response.content[0].text)
            return customized_latex
            
        except Exception as e:
            raise Exception(f"Claude API error: {str(e)}")
    
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