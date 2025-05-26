# app/api/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from supabase import Client
from app.core.supabase import get_supabase_client
from app.dependencies import get_current_user
from pydantic import BaseModel, EmailStr

router = APIRouter()
security = HTTPBearer()

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str

@router.post("/login", response_model=AuthResponse)
async def login(
    login_data: LoginRequest,
    supabase: Client = Depends(get_supabase_client)
):
    """User login endpoint"""
    try:
        print(f"Attempting login for: {login_data.email}")
        
        # Use the auth.sign_in_with_password method
        response = supabase.auth.sign_in_with_password({
            "email": login_data.email,
            "password": login_data.password
        })
        
        if not response.user or not response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        print(f"✅ Login successful for: {login_data.email}")
        
        return AuthResponse(
            access_token=response.session.access_token,
            user_id=response.user.id,
            email=response.user.email
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

@router.post("/signup", response_model=AuthResponse)
async def signup(
    signup_data: SignupRequest,
    supabase: Client = Depends(get_supabase_client)
):
    """User signup endpoint"""
    try:
        print(f"Attempting signup for: {signup_data.email}")
        
        response = supabase.auth.sign_up({
            "email": signup_data.email,
            "password": signup_data.password,
            "options": {
                "data": {
                    "full_name": signup_data.full_name
                }
            }
        })
        
        if not response.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create account"
            )
        
        print(f"✅ Signup successful for: {signup_data.email}")
        
        # Try to get session, if not available, attempt login
        if response.session:
            return AuthResponse(
                access_token=response.session.access_token,
                user_id=response.user.id,
                email=response.user.email
            )
        else:
            # Try to sign in immediately after signup
            login_response = supabase.auth.sign_in_with_password({
                "email": signup_data.email,
                "password": signup_data.password
            })
            
            if login_response.session and login_response.user:
                return AuthResponse(
                    access_token=login_response.session.access_token,
                    user_id=login_response.user.id,
                    email=login_response.user.email
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_201_CREATED, 
                    detail="Account created successfully. Please try logging in."
                )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Signup error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create account: {str(e)}"
        )

@router.post("/logout")
async def logout(
    current_user = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """User logout endpoint"""
    try:
        supabase.auth.sign_out()
        return {"message": "Successfully logged out"}
    except Exception as e:
        print(f"Logout error: {e}")
        return {"message": "Logged out"}

@router.get("/me")
async def get_current_user_info(current_user = Depends(get_current_user)):
    """Get current user information"""
    return {
        "user_id": current_user.id,
        "email": current_user.email,
        "metadata": getattr(current_user, 'user_metadata', {})
    }