# Resume Customizer - Debugging Guide

## Quick Fix Verification

If you're still experiencing issues after applying the fixes, follow these steps:

### 1. Install/Update Dependencies
```bash
cd C:\projects\resume_customizer
pip install -r requirements.txt
```

### 2. Run Test Script
```bash
python test_fixes.py
```

### 3. Check Environment Variables
Make sure your `.env` file contains:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
CLAUDE_API_KEY=sk-ant-api03-...
APP_NAME=Resume Customizer
DEBUG=True
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000,http://127.0.0.1:8000
TEMP_FILE_DIRECTORY=temp_files
MAX_FILE_SIZE=10485760
```

### 4. Start Server with Debugging
```bash
uvicorn app.main:app --reload --port 8000 --log-level debug
```

## Common Issues & Solutions

### Issue 1: "pdflatex not found" Warning
**What it means**: LaTeX is not installed locally, using online PDF generation
**Solution**: This is expected and should work fine. The online service will be used.

### Issue 2: Module Import Errors
**Symptoms**: `ModuleNotFoundError` in logs
**Solution**: 
```bash
pip install fastapi uvicorn supabase anthropic aiohttp aiofiles
```

### Issue 3: Claude API Errors
**Symptoms**: "Claude API error" in customization
**Solution**: 
- Check your Claude API key in `.env`
- Ensure you have sufficient API credits
- Verify the API key format: `sk-ant-api03-...`

### Issue 4: Supabase Connection Errors
**Symptoms**: Authentication failures, database errors
**Solution**:
- Verify Supabase URL and keys in `.env`
- Check if your Supabase project is active
- Ensure RLS policies are set up correctly

### Issue 5: PDF Generation Timeouts
**Symptoms**: Long delays or timeouts during PDF generation
**Solution**:
- Using online PDF service (expected for complex documents)
- Check internet connection
- Try with simpler LaTeX content first

## Testing Individual Components

### Test PDF Generation Only:
```python
import asyncio
from app.core.pdf_generator import pdf_generator

async def test():
    latex = r"\documentclass{article}\begin{document}Hello World\end{document}"
    pdf_path = await pdf_generator.latex_to_pdf(latex, "test")
    print(f"PDF created: {pdf_path}")

asyncio.run(test())
```

### Test Claude Service Only:
```python
import asyncio
from app.core.claude import claude_service
from app.models.resume import ResumeSections

async def test():
    result = await claude_service.customize_resume(
        "\\documentclass{article}\\begin{document}Test\\end{document}",
        "Software Engineer",
        [ResumeSections.EXPERIENCE],
        30
    )
    print(f"Customized: {result[:100]}...")

asyncio.run(test())
```

## Log Analysis

Look for these patterns in your server logs:

### Good Signs:
```
✅ Supabase client created successfully
Warning: pdflatex not found. Using online PDF generation service.
INFO: Started server process
```

### Bad Signs:
```
❌ ModuleNotFoundError: No module named 'aiohttp'
❌ Claude API error: Invalid API key
❌ Failed to generate PDF: [error details]
```

## Manual Testing Steps

1. **Start Server**: `uvicorn app.main:app --reload --port 8000`
2. **Open Browser**: Go to `http://localhost:8000/login`
3. **Login**: Use your credentials
4. **Test PDF View**: Select a resume - should show PDF on right
5. **Test Customization**: Enter job description, click Generate
6. **Check Console**: Look for any error messages

## Final Checklist

- [ ] All dependencies installed
- [ ] Environment variables configured
- [ ] `temp_files` directory exists
- [ ] Server starts without errors
- [ ] Can login to application
- [ ] Can view resume PDFs
- [ ] Can customize resumes
- [ ] No 500 errors in browser console

If you're still having issues after following this guide, check the server logs for specific error messages and share those for further debugging.
