# app/models/user.py
from pydantic import BaseModel, EmailStr
from typing import Optional

class User(BaseModel):
    id: str
    email: EmailStr
    full_name: Optional[str] = None
    created_at: Optional[str] = None
