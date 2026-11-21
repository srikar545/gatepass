from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field
from models import VisitStatus, Role

PHONE = r"^\d{10,15}$"


class LoginIn(BaseModel):
    phone: str = Field(pattern=PHONE)
    pin: str = Field(min_length=4, max_length=20)


class FcmTokenIn(BaseModel):
    token: str = Field(min_length=20, max_length=500)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Role
    name: str


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(pattern=PHONE)
    pin: str = Field(min_length=4, max_length=20)
    role: Role
    flat_no: Optional[str] = None  # required for RESIDENT


class UserOut(BaseModel):
    id: int
    name: str
    phone: str
    role: Role
    flat_id: Optional[int]
    flat_no: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class VisitCreate(BaseModel):
    guest_name: str = Field(min_length=1, max_length=100)
    guest_phone: str = Field(pattern=PHONE)
    flat_no: str = Field(min_length=1, max_length=10)
    purpose: Optional[str] = Field(default=None, max_length=200)


class DecisionIn(BaseModel):
    decision: Literal["APPROVED", "REJECTED"]


class VisitOut(BaseModel):
    id: int
    guest_name: str
    guest_phone: str
    flat_id: int
    flat_no: Optional[str] = None
    purpose: Optional[str]
    status: VisitStatus
    created_at: datetime
    decided_at: Optional[datetime]
    checkin_at: Optional[datetime]
    checkout_at: Optional[datetime]

    class Config:
        from_attributes = True
