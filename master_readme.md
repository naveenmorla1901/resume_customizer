# 🎯 Resume Customizer - AI-Powered Resume Tailoring Platform

## 📋 **Project Overview**

Resume Customizer is a full-stack web application that allows users to intelligently customize their LaTeX-based resumes for specific job applications using Claude AI. The platform enables users to upload their master resume in LaTeX format and automatically tailor it to match job descriptions while maintaining professional formatting.

### **Core Value Proposition**
- **AI-Powered Customization**: Uses Claude API to intelligently modify resume content based on job descriptions
- **LaTeX-Based**: Maintains professional document formatting and styling
- **Selective Modification**: Users choose which resume sections to customize (Experience, Skills, Projects, etc.)
- **Percentage Control**: Users control the intensity of modifications (10-90%)
- **PDF Generation**: Real-time PDF preview and download functionality
- **User Management**: Secure authentication and personal resume libraries

---

## 🏗️ **Architecture Overview**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │────│   FastAPI       │────│   Supabase      │
│   (Vanilla JS)  │    │   Backend       │    │   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        
         │                        │                        
         ▼                        ▼                        
┌─────────────────┐    ┌─────────────────┐               
│   User Browser  │    │   Claude API    │               
│   (PDF Preview) │    │   (AI Engine)   │               
└─────────────────┘    └─────────────────┘               
```

### **Technology Stack**
- **Backend**: FastAPI (Python) with async support
- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5, CSS3
- **Database**: Supabase (PostgreSQL with real-time features)
- **Authentication**: Supabase Auth (JWT-based)
- **AI Integration**: Anthropic Claude API
- **PDF Generation**: Online LaTeX compilation service
- **Styling**: Modern CSS with CSS variables, Flexbox/Grid
- **Deployment**: Docker-ready, supports Railway/Render/Heroku

---

## 📁 **Complete File Structure**

```
resume_customizer/
├── 📄 README.md                    # This master documentation
├── 📄 requirements.txt             # Python dependencies
├── 📄 .env                         # Environment variables (not in git)
├── 📄 docker-compose.yml           # Docker configuration (optional)
├── 📄 Dockerfile                   # Container setup (optional)
│
├── 📁 app/                         # FastAPI Backend
│   ├── 📄 __init__.py
│   ├── 📄 main.py                  # FastAPI app entry point
│   ├── 📄 config.py                # Configuration settings
│   ├── 📄 dependencies.py          # Auth dependencies
│   │
│   ├── 📁 api/                     # API Routes
│   │   ├── 📄 __init__.py
│   │   ├── 📄 auth.py              # Authentication endpoints
│   │   ├── 📄 resumes.py           # Resume CRUD operations
│   │   └── 📄 customization.py     # AI customization endpoints
│   │
│   ├── 📁 core/                    # Core Services
│   │   ├── 📄 __init__.py
│   │   ├── 📄 supabase.py          # Database client
│   │   ├── 📄 claude.py            # Claude AI integration
│   │   └── 📄 pdf_generator.py     # LaTeX to PDF conversion
│   │
│   ├── 📁 models/                  # Data Models
│   │   ├── 📄 __init__.py
│   │   ├── 📄 user.py              # User data models
│   │   └── 📄 resume.py            # Resume data models
│   │
│   ├── 📁 schemas/                 # Pydantic Schemas
│   │   ├── 📄 __init__.py
│   │   ├── 📄 auth.py              # Auth request/response schemas
│   │   ├── 📄 resume.py            # Resume schemas
│   │   └── 📄 customization.py     # Customization schemas
│   │
│   └── 📁 utils/                   # Utility Functions
│       ├── 📄 __init__.py
│       ├── 📄 validation.py        # Input validation
│       └── 📄 file_handler.py      # File operations
│
├── 📁 frontend/                    # Frontend Application
│   ├── 📄 index.html               # Main application page
│   ├── 📄 login.html               # Authentication page
│   │
│   ├── 📁 css/                     # Stylesheets
│   │   ├── 📄 main.css             # Global styles & utilities
│   │   ├── 📄 components.css       # Auth & component styles
│   │   └── 📄 app.css              # Main application styles
│   │
│   ├── 📁 js/                      # JavaScript Application
│   │   ├── 📄 api.js               # API client & HTTP requests
│   │   ├── 📄 auth.js              # Authentication logic
│   │   ├── 📄 main.js              # Main application controller
│   │   └── 📁 components/          # Reusable Components
│   │       ├── 📄 customizer.js    # Resume customization component
│   │       ├── 📄 pdfViewer.js     # PDF preview component
│   │       └── 📄 resumeList.js    # Resume management component
│   │
│   └── 📁 assets/                  # Static Assets
│       └── 📁 images/              # Images and icons
│
└── 📁 temp_files/                  # Temporary PDF storage
```

---

## 🔑 **Environment Variables**

```bash
# .env file configuration
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

---

## 🗃️ **Database Schema (Supabase/PostgreSQL)**

### **Tables Structure**

```sql
-- Users table (managed by Supabase Auth)
auth.users (
    id UUID PRIMARY KEY,
    email VARCHAR,
    created_at TIMESTAMP,
    user_metadata JSONB
)

-- Resumes table
public.resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    latex_content TEXT NOT NULL,
    resume_type VARCHAR(20) DEFAULT 'original' CHECK (resume_type IN ('original', 'temporary')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)

-- Customization logs (audit trail)
public.customization_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    original_resume_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL,
    job_description TEXT NOT NULL,
    sections_modified TEXT[] NOT NULL,
    modification_percentage INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

### **Row Level Security (RLS)**
- Users can only access their own resumes and logs
- Automatic user isolation through auth.uid()
- Real-time subscriptions support

---

## 🌐 **API Endpoints**

### **Authentication Endpoints**
```
POST   /api/auth/signup          # Create new user account
POST   /api/auth/login           # User login
POST   /api/auth/logout          # User logout
GET    /api/auth/me              # Get current user info
```

### **Resume Management Endpoints**
```
GET    /api/resumes/             # List user's resumes
POST   /api/resumes/             # Create new resume
GET    /api/resumes/{id}         # Get specific resume
PUT    /api/resumes/{id}         # Update resume
DELETE /api/resumes/{id}         # Delete resume
GET    /api/resumes/{id}/pdf     # Download resume PDF
```

### **Customization Endpoints**
```
POST   /api/customize/           # Customize resume with AI
GET    /api/customize/preview/{temp_id}        # Preview customized resume
POST   /api/customize/save-customized/{temp_id} # Save temporary resume
```

### **Utility Endpoints**
```
GET    /api/health               # Health check
GET    /                         # Redirect to login
GET    /login                    # Serve login page
GET    /app                      # Serve main application
```

---

## 🔄 **Application Flow**

### **1. User Authentication Flow**
```
Login Page → Enter Credentials → Supabase Auth → JWT Token → Main App
     ↓
Signup Page → Create Account → Auto Login → Main App
```

### **2. Resume Management Flow**
```
Main App → Sidebar → Add Resume → Enter LaTeX → Save → Auto Select
    ↓
Select Resume → PDF Preview → Customization Interface
```

### **3. AI Customization Flow**
```
Select Resume → Enter Job Description → Choose Sections → Set Percentage
    ↓
Generate Button → Claude API → LaTeX Processing → PDF Generation
    ↓
Preview PDF → Download/Save Options → Update Resume Library
```

---

## 🎨 **Frontend Architecture**

### **Page Structure**
1. **Login Page** (`login.html`)
   - Authentication forms (login/signup)
   - Form validation and error handling
   - Smooth transitions between forms

2. **Main Application** (`index.html`)
   - Header with user info and logout
   - Sidebar with resume list
   - Main content area with customization interface
   - PDF preview panel

### **JavaScript Architecture**
- **ES6 Modules**: Modern module system
- **API Client**: Centralized HTTP request handling
- **Component System**: Reusable UI components
- **State Management**: Local state with reactive updates
- **Event Handling**: Comprehensive event system

### **CSS Architecture**
- **CSS Variables**: Consistent theming system
- **Mobile-First**: Responsive design approach
- **Component-Based**: Modular styling approach
- **Accessibility**: WCAG compliant design

---

## 📊 **Key Components**

### **Backend Components**

1. **FastAPI App** (`app/main.py`)
   - CORS configuration
   - Route registration
   - Static file serving
   - Error handling

2. **Supabase Client** (`app/core/supabase.py`)
   - Database connection management
   - Authentication integration
   - Real-time subscriptions ready

3. **Claude Service** (`app/core/claude.py`)
   - AI prompt engineering
   - Response processing
   - Error handling and retries

4. **PDF Generator** (`app/core/pdf_generator.py`)
   - LaTeX to PDF conversion
   - Online service integration
   - Local LaTeX support (optional)

### **Frontend Components**

1. **API Client** (`frontend/js/api.js`)
   - HTTP request wrapper
   - Authentication handling
   - Error processing
   - File download utilities

2. **Resume List** (`frontend/js/components/resumeList.js`)
   - Resume display and selection
   - CRUD operations UI
   - Active state management

3. **PDF Viewer** (`frontend/js/components/pdfViewer.js`)
   - PDF preview functionality
   - Download management
   - Loading states

4. **Customizer** (`frontend/js/components/customizer.js`)
   - Form handling
   - Validation logic
   - AI integration UI

---

## 🔧 **Core Business Logic**

### **Resume Customization Process**

1. **Input Processing**
   - User selects base resume
   - Provides job description
   - Chooses sections to modify
   - Sets modification percentage

2. **AI Processing**
   - Claude API receives structured prompt
   - Analyzes job requirements
   - Modifies selected LaTeX sections
   - Maintains document structure

3. **Output Generation**
   - LaTeX validation
   - PDF compilation
   - Preview generation
   - Storage as temporary resume

### **Claude AI Prompt Engineering**
```
Template: "Here is a resume in LaTeX format and a job description. 
Customize mainly these sections: {sections}. 
Keep the resume length similar. 
Modify it to match the job description by {percentage}%. 
Output only the updated LaTeX code."
```

---

## ✅ **Currently Implemented Features**

### **Authentication System**
- ✅ User registration with Supabase
- ✅ Secure login/logout
- ✅ JWT token management
- ✅ Session persistence
- ✅ User profile management

### **Resume Management**
- ✅ Create/Read/Update/Delete resumes
- ✅ LaTeX content validation
- ✅ PDF preview generation
- ✅ Resume list with active states
- ✅ Temporary resume system

### **AI Customization**
- ✅ Claude API integration
- ✅ Selective section modification
- ✅ Percentage-based customization
- ✅ Real-time PDF generation
- ✅ Download and save functionality

### **User Interface**
- ✅ Responsive design (mobile/desktop)
- ✅ Modern CSS with animations
- ✅ Dark mode support
- ✅ Accessibility features
- ✅ Loading states and error handling

### **Technical Infrastructure**
- ✅ FastAPI backend with async support
- ✅ Supabase database with RLS
- ✅ Docker-ready configuration
- ✅ Environment-based configuration
- ✅ CORS and security headers

---

## 🚧 **Planned Features & Improvements**

### **High Priority**
- [ ] **Resume Templates**: Pre-built LaTeX templates for different industries
- [ ] **Job Application Tracking**: Link customized resumes to job applications
- [ ] **Resume Analytics**: Success rates and performance tracking
- [ ] **Bulk Customization**: Apply one job description to multiple resumes
- [ ] **Version History**: Track resume changes over time

### **Medium Priority**
- [ ] **Team/Company Features**: Shared resume templates and branding
- [ ] **Integration APIs**: Connect with job boards (LinkedIn, Indeed)
- [ ] **Advanced AI Features**: Cover letter generation, interview prep
- [ ] **Real-time Collaboration**: Multiple users editing resumes
- [ ] **Mobile App**: React Native or Progressive Web App

### **Low Priority**
- [ ] **Resume Scoring**: AI-powered resume quality assessment
- [ ] **Market Intelligence**: Job market trends and recommendations
- [ ] **Social Features**: Resume sharing and feedback
- [ ] **Advanced Analytics**: Detailed user behavior insights
- [ ] **White-label Solution**: Custom branding for enterprises

---

## 🚀 **Setup Instructions**

### **Prerequisites**
- Python 3.11+
- Node.js 16+ (optional, for frontend development)
- Supabase account
- Claude API key

### **Quick Start**
```bash
# 1. Clone and setup
git clone <repository>
cd resume_customizer

# 2. Create virtual environment
python -m venv resume_customizer
source resume_customizer/bin/activate  # Linux/Mac
# or
resume_customizer\Scripts\activate     # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Setup environment
cp .env.example .env
# Edit .env with your keys

# 5. Setup database
# Run SQL schema in Supabase dashboard

# 6. Start application
uvicorn app.main:app --reload --port 8000

# 7. Access application
# Login: http://localhost:8000/login
# Main App: http://localhost:8000/app
# API Docs: http://localhost:8000/docs
```

### **Database Setup**
1. Create Supabase project
2. Run the SQL schema from the database section
3. Configure RLS policies
4. Get API keys from project settings

---

## 🔍 **Testing Strategy**

### **Manual Testing Checklist**
- [ ] User can create account and login
- [ ] Resume CRUD operations work
- [ ] PDF preview loads correctly
- [ ] AI customization produces valid LaTeX
- [ ] Download functionality works
- [ ] Mobile responsiveness
- [ ] Error handling and validation

### **Automated Testing (Future)**
- [ ] Unit tests for backend logic
- [ ] Integration tests for API endpoints
- [ ] Frontend component tests
- [ ] End-to-end user flow tests
- [ ] Performance and load testing

---

## 🐛 **Common Issues & Solutions**

### **Supabase Connection Issues**
```python
# Error: 'dict' object has no attribute 'headers'
# Solution: Use simple create_client call
supabase = create_client(url, key)  # Not create_client(url, key, options={})
```

### **PDF Generation Issues**
```bash
# Warning: pdflatex not found
# Solution: App uses online PDF service automatically
# For local: Install LaTeX distribution (TeX Live/MiKTeX)
```

### **CORS Issues**
```python
# Add all necessary origins to ALLOWED_ORIGINS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000,http://127.0.0.1:8000
```

### **Claude API Issues**
```python
# Rate limiting or quota exceeded
# Solution: Implement exponential backoff, user feedback
# Check API key validity and billing status
```

---

## 📈 **Performance Considerations**

### **Current Performance**
- **API Response**: < 200ms for CRUD operations
- **AI Processing**: 30-60 seconds for customization
- **PDF Generation**: 5-15 seconds depending on service
- **Frontend Load**: < 2 seconds on modern browsers

### **Optimization Opportunities**
- **Caching**: Redis for frequently generated PDFs
- **CDN**: Static asset delivery
- **Database**: Connection pooling and query optimization
- **Frontend**: Code splitting and lazy loading
- **AI**: Request batching and result caching

---

## 🚢 **Deployment Guide**

### **Recommended Platforms**
1. **Railway** (Easiest for beginners)
2. **Render** (Good free tier)
3. **Heroku** (Popular choice)
4. **DigitalOcean App Platform**
5. **AWS/GCP/Azure** (Advanced users)

### **Environment Variables for Production**
```bash
DEBUG=False
ALLOWED_ORIGINS=https://yourdomain.com
# Use production Supabase keys
# Enable HTTPS redirect
```

### **Docker Deployment**
```bash
docker-compose up -d
```

---

## 💡 **Business Model Considerations**

### **Monetization Options**
- **Freemium**: Limited customizations per month
- **Subscription**: Unlimited access + premium features
- **Enterprise**: Team features + custom branding
- **API Access**: Developer-focused pricing

### **Market Positioning**
- **Target Users**: Job seekers, career coaches, recruiters
- **Competitive Advantage**: AI-powered customization + LaTeX quality
- **Value Proposition**: Time savings + higher success rates

---

## 🤝 **Contributing Guidelines**

### **Code Standards**
- Python: Black formatting, type hints
- JavaScript: ES6+, JSDoc comments
- CSS: BEM methodology, CSS variables
- Git: Conventional commits

### **Development Workflow**
1. Fork repository
2. Create feature branch
3. Write tests (when available)
4. Update documentation
5. Submit pull request

---

## 📞 **Support & Maintenance**

### **Monitoring**
- [ ] Error logging (Sentry integration)
- [ ] Performance monitoring
- [ ] User analytics
- [ ] API usage tracking

### **Backup Strategy**
- [ ] Database backups (Supabase handles this)
- [ ] Code repository (Git)
- [ ] Environment configuration
- [ ] User-generated content

---

## 📚 **Additional Resources**

### **Documentation Links**
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Supabase Documentation](https://supabase.com/docs)
- [Claude API Documentation](https://docs.anthropic.com/)
- [LaTeX Documentation](https://www.latex-project.org/help/documentation/)

### **Learning Resources**
- FastAPI tutorials and best practices
- Supabase auth and RLS patterns
- Claude prompt engineering guides
- Modern JavaScript ES6+ features

---

**This README serves as the complete knowledge base for the Resume Customizer project. Any new contributor or AI assistant should be able to understand the entire system architecture, current implementation status, and future roadmap from this document.**

*Last Updated: Current Session*
*Project Status: MVP Complete, Ready for Enhancement*