# 🔧 Resume Customizer - Setup & Troubleshooting Guide

This guide covers database setup, configuration, and troubleshooting for the Resume Customizer application.

## 📋 **Table of Contents**
- [Database Setup](#database-setup)
- [Environment Configuration](#environment-configuration)
- [Troubleshooting Guide](#troubleshooting-guide)
- [Performance Optimization](#performance-optimization)
- [Security Configuration](#security-configuration)

---

## 🗃️ **Database Setup**

### **Supabase Project Creation**

1. **Create Supabase Project**
   - Go to https://supabase.com
   - Create new project
   - Note down project URL and API keys

2. **Database Schema Setup**
   
   Run the following SQL in your Supabase SQL Editor:

```sql
-- Enable Row Level Security
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create resumes table
CREATE TABLE public.resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    latex_content TEXT NOT NULL,
    resume_type VARCHAR(20) DEFAULT 'original' CHECK (resume_type IN ('original', 'temporary')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create customization logs table (audit trail)
CREATE TABLE public.customization_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    original_resume_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
    job_description TEXT NOT NULL,
    sections_modified TEXT[] NOT NULL,
    modification_percentage INTEGER NOT NULL,
    ai_provider VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on custom tables
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customization_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for resumes
CREATE POLICY "Users can view own resumes" ON public.resumes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resumes" ON public.resumes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resumes" ON public.resumes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own resumes" ON public.resumes
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for customization logs
CREATE POLICY "Users can view own customization logs" ON public.customization_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own customization logs" ON public.customization_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_resumes_user_id ON public.resumes(user_id);
CREATE INDEX idx_resumes_user_type ON public.resumes(user_id, resume_type);
CREATE INDEX idx_customization_logs_user_id ON public.customization_logs(user_id);
CREATE INDEX idx_customization_logs_created_at ON public.customization_logs(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for resumes table
CREATE TRIGGER update_resumes_updated_at
    BEFORE UPDATE ON public.resumes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

3. **Authentication Configuration**
   - Enable Email/Password authentication in Supabase Auth settings
   - Optionally enable Google/GitHub OAuth
   - Configure redirect URLs: `http://localhost:8000/app`

---

## ⚙️ **Environment Configuration**

### **Complete .env Setup**

Create `.env` file with all required variables:

```bash
# Supabase Configuration (Required)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AI Provider API Keys (At least one required)
CLAUDE_API_KEY=sk-ant-api03-...                    # Anthropic Console
GEMINI_API_KEY=AIzaSy...                           # Google AI Studio  
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx...            # DeepSeek Platform

# Application Settings
APP_NAME=Resume Customizer
DEBUG=True
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000,http://127.0.0.1:8000

# File Storage Settings
TEMP_FILE_DIRECTORY=temp_files
MAX_FILE_SIZE=10485760

# PDF Generation Settings (Optional)
PDF_GENERATION_METHOD=online
PDF_TIMEOUT=30
PDF_MAX_RETRIES=3

# Logging Settings (Optional)
LOG_LEVEL=INFO
LOG_FORMAT=%(asctime)s - %(name)s - %(levelname)s - %(message)s
```

### **API Key Validation**

Run this script to validate your API keys:

```python
#!/usr/bin/env python3
"""API Key Validation Script"""

import os
import asyncio
import aiohttp
from dotenv import load_dotenv

load_dotenv()

async def validate_api_keys():
    """Validate all API keys"""
    results = {}
    
    # Validate Claude API Key
    claude_key = os.getenv('CLAUDE_API_KEY')
    if claude_key and claude_key.startswith('sk-ant-'):
        results['Claude'] = "✅ Format valid"
    elif claude_key:
        results['Claude'] = "❌ Invalid format (should start with sk-ant-)"
    else:
        results['Claude'] = "⚠️ Not configured"
    
    # Validate Gemini API Key  
    gemini_key = os.getenv('GEMINI_API_KEY')
    if gemini_key and gemini_key.startswith('AIza'):
        results['Gemini'] = "✅ Format valid"
    elif gemini_key:
        results['Gemini'] = "❌ Invalid format (should start with AIza)"
    else:
        results['Gemini'] = "⚠️ Not configured"
    
    # Validate DeepSeek API Key
    deepseek_key = os.getenv('DEEPSEEK_API_KEY')
    if deepseek_key and deepseek_key.startswith('sk-') and len(deepseek_key) >= 40:
        results['DeepSeek'] = "✅ Format valid"
    elif deepseek_key and len(deepseek_key) < 40:
        results['DeepSeek'] = f"❌ Too short ({len(deepseek_key)} chars, need 40+)"
    elif deepseek_key:
        results['DeepSeek'] = "❌ Invalid format (should start with sk-)"
    else:
        results['DeepSeek'] = "⚠️ Not configured"
    
    # Validate Supabase
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_ANON_KEY')
    if supabase_url and supabase_key:
        results['Supabase'] = "✅ Configured"
    else:
        results['Supabase'] = "❌ Missing URL or key"
    
    print("🔑 API Key Validation Results:")
    print("=" * 40)
    for provider, status in results.items():
        print(f"{provider}: {status}")
    
    return results

if __name__ == "__main__":
    asyncio.run(validate_api_keys())
```

---

## 🔍 **Troubleshooting Guide**

### **Database Issues**

**Connection Failed**
```bash
# Symptoms: "Failed to connect to Supabase"
# Causes: Wrong URL/keys, project paused, network issues

# Solutions:
1. Verify SUPABASE_URL and keys in .env
2. Check if Supabase project is active (not paused)
3. Test connection: curl https://your-project.supabase.co/rest/v1/
4. Ensure RLS policies are configured correctly
```

**RLS Policy Errors**
```bash
# Symptoms: "Row level security policy violation"
# Causes: Missing or incorrect RLS policies

# Solutions:
1. Run the complete database schema (see above)
2. Verify auth.uid() matches user_id in queries
3. Check policy syntax in Supabase dashboard
4. Test with service role key temporarily (for debugging only)
```

### **AI Provider Issues**

**DeepSeek API Errors**
```bash
# Symptoms: "DeepSeek API key format is incorrect"
# Causes: API key too short or invalid format

# Solutions:
1. Get new API key from https://platform.deepseek.com/api_keys
2. Ensure key is 40+ characters long
3. Format: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
4. Check account has sufficient credits
```

**Claude Compatibility Issues**
```bash
# Symptoms: "HTTPTransport.__init__() got unexpected keyword argument"
# Causes: Package version conflicts

# Solutions:
1. pip install "anthropic>=0.50.0" "httpx>=0.24.0,<0.25.0"
2. Clear pip cache: pip cache purge
3. Recreate virtual environment if needed
```

**Gemini Rate Limiting**
```bash
# Symptoms: HTTP 429 errors from Gemini API
# Causes: Too many requests, quota exceeded

# Solutions:
1. Check quota in Google AI Studio
2. Implement exponential backoff (already built-in)
3. Upgrade to paid tier if needed
```

### **PDF Generation Issues**

**PDF Generation Failed**
```bash
# Symptoms: "Failed to generate PDF"
# Causes: Invalid LaTeX, service timeout, network issues

# Solutions:
1. Validate LaTeX syntax
2. Check internet connection (online PDF services)
3. Verify temp_files directory exists and is writable
4. Check server logs for specific LaTeX errors
```

**PDF Preview Not Loading**
```bash
# Symptoms: Blank PDF viewer or loading errors
# Causes: File permissions, path issues, browser cache

# Solutions:
1. Clear browser cache (Ctrl+Shift+R)
2. Check file permissions on temp_files directory
3. Verify PDF file was actually created
4. Test with a simple LaTeX document
```

### **Performance Issues**

**Slow AI Response Times**
```bash
# Symptoms: Customization takes >60 seconds
# Causes: Large LaTeX content, network latency, AI provider load

# Solutions:
1. Reduce LaTeX content size
2. Try different AI provider
3. Check provider status pages
4. Increase timeout settings if needed
```

**Memory Usage High**
```bash
# Symptoms: Server running out of memory
# Causes: Large PDF files not cleaned up, memory leaks

# Solutions:
1. Check temp_files directory size
2. Restart server to clear memory
3. Reduce MAX_FILE_SIZE if needed
4. Monitor background cleanup tasks
```

---

## 🚀 **Performance Optimization**

### **Database Optimization**

```sql
-- Additional indexes for better performance
CREATE INDEX CONCURRENTLY idx_resumes_created_at 
ON public.resumes(created_at DESC);

CREATE INDEX CONCURRENTLY idx_resumes_name_text 
ON public.resumes USING gin(to_tsvector('english', name));

-- Vacuum and analyze regularly
VACUUM ANALYZE public.resumes;
VACUUM ANALYZE public.customization_logs;
```

### **Application Optimization**

```python
# Connection pooling (add to app/core/supabase.py)
from supabase.client import ClientOptions

client_options = ClientOptions(
    postgrest_client_timeout=10,
    storage_client_timeout=10
)

supabase = create_client(url, key, options=client_options)
```

### **Caching Configuration**

```python
# Add Redis caching for AI provider responses
import redis
from functools import wraps

redis_client = redis.Redis(host='localhost', port=6379, db=0)

def cache_ai_response(expiration=3600):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache_key = f"ai_response:{hash(str(args) + str(kwargs))}"
            cached = redis_client.get(cache_key)
            if cached:
                return cached.decode()
            
            result = await func(*args, **kwargs)
            redis_client.setex(cache_key, expiration, result)
            return result
        return wrapper
    return decorator
```

---

## 🔐 **Security Configuration**

### **Production Security Settings**

```bash
# Production .env settings
DEBUG=False
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Add these for production
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=True
SECURE_CONTENT_TYPE_NOSNIFF=True
SECURE_BROWSER_XSS_FILTER=True
```

### **API Rate Limiting**

```python
# Add to main.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply to endpoints
@limiter.limit("5/minute")
@router.post("/customize/")
async def customize_resume(request: Request, ...):
    # Your endpoint logic
```

### **Input Validation**

```python
# Enhanced LaTeX validation
import re

def validate_latex_content(latex_content: str) -> bool:
    """Validate LaTeX content for security and correctness"""
    
    # Check for required document structure
    if not re.search(r'\\documentclass', latex_content):
        return False
    if not re.search(r'\\begin{document}', latex_content):
        return False
    if not re.search(r'\\end{document}', latex_content):
        return False
    
    # Block potentially dangerous commands
    dangerous_commands = [
        r'\\input{',
        r'\\include{',
        r'\\write18',
        r'\\immediate',
        r'\\openout',
        r'\\openin'
    ]
    
    for cmd in dangerous_commands:
        if re.search(cmd, latex_content, re.IGNORECASE):
            return False
    
    # Check file size (prevent DoS)
    if len(latex_content) > 100000:  # 100KB limit
        return False
    
    return True
```

---

## 📊 **Health Monitoring**

### **Health Check Endpoint**

```python
# Add to app/api/health.py
from fastapi import APIRouter
import psutil
import os

router = APIRouter()

@router.get("/health")
async def health_check():
    """Comprehensive health check"""
    
    # Check disk space
    disk_usage = psutil.disk_usage('/')
    disk_free_gb = disk_usage.free // (1024**3)
    
    # Check memory usage
    memory = psutil.virtual_memory()
    memory_available_gb = memory.available // (1024**3)
    
    # Check temp files directory
    temp_dir = os.getenv('TEMP_FILE_DIRECTORY', 'temp_files')
    temp_files_count = len(os.listdir(temp_dir)) if os.path.exists(temp_dir) else 0
    
    return {
        "status": "healthy",
        "disk_free_gb": disk_free_gb,
        "memory_available_gb": memory_available_gb,
        "temp_files_count": temp_files_count,
        "ai_providers": ai_service.get_available_providers()
    }
```

### **Logging Configuration**

```python
# Enhanced logging setup
import logging
import sys
from logging.handlers import RotatingFileHandler

def setup_logging():
    """Configure application logging"""
    
    log_level = os.getenv('LOG_LEVEL', 'INFO')
    log_format = os.getenv('LOG_FORMAT', 
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(logging.Formatter(log_format))
    
    # File handler with rotation
    file_handler = RotatingFileHandler(
        'app.log', maxBytes=10*1024*1024, backupCount=5
    )
    file_handler.setFormatter(logging.Formatter(log_format))
    
    # Configure root logger
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        handlers=[console_handler, file_handler]
    )
```

---

## 🧪 **Testing Setup**

### **Test Database Setup**

```sql
-- Create test database (run in separate Supabase project)
-- Use same schema as above but with test data

-- Test data insertion
INSERT INTO public.resumes (user_id, name, latex_content, resume_type) VALUES
('test-user-id', 'Test Resume', '\documentclass{article}\begin{document}Test Content\end{document}', 'original');
```

### **Integration Testing**

```python
# test_setup.py
import pytest
import asyncio
from httpx import AsyncClient
from app.main import app

@pytest.fixture
def client():
    return AsyncClient(app=app, base_url="http://test")

@pytest.mark.asyncio
async def test_health_endpoint(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

@pytest.mark.asyncio  
async def test_ai_providers_endpoint(client):
    response = await client.get("/api/customize/providers")
    assert response.status_code == 200
    providers = response.json()["available_providers"]
    assert len(providers) > 0
```

---

**🎯 This setup guide should get your Resume Customizer fully configured and running smoothly!**

For additional help, check the main README.md or server logs for specific error messages.
