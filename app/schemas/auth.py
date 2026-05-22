from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import List, Optional

from app.schemas.validators import (
    digits_only,
    validate_cpf_value,
    validate_email_value,
    validate_phone_value,
)


class LoginRequest(BaseModel):
    identifier: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=4)


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    full_name: str = Field(..., min_length=2, max_length=200)
    email: str = Field(..., max_length=200)
    password: str = Field(..., min_length=6)
    role: str = Field(default='viewer')

    @field_validator('email')
    @classmethod
    def validate_email(cls, value: str) -> str:
        return validate_email_value(value)


class StudentRegisterRequest(BaseModel):
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=2, max_length=200)
    age: Optional[int] = Field(None, ge=14, le=100)
    email: str = Field(..., max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    gender: Optional[str] = Field(None, max_length=20)
    cpf: str = Field(..., min_length=11, max_length=14)
    registration_number: str = Field(..., min_length=3, max_length=20)
    course_name: Optional[str] = Field(None, max_length=200)
    current_period: Optional[int] = Field(None, ge=1, le=12)
    class_schedule: Optional[str] = Field(None)
    is_working: Optional[bool] = Field(default=False)
    work_schedule: Optional[str] = Field(None, max_length=100)
    lyceum_password: Optional[str] = Field(None, max_length=200)

    @field_validator('email')
    @classmethod
    def validate_email(cls, value: str) -> str:
        return validate_email_value(value)

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, value: Optional[str]) -> Optional[str]:
        return validate_phone_value(value)

    @field_validator('cpf')
    @classmethod
    def validate_cpf(cls, value: str) -> str:
        return validate_cpf_value(value)

    @field_validator('registration_number')
    @classmethod
    def validate_registration_number(cls, value: str) -> str:
        cleaned = str(value or '').strip()
        if not cleaned:
            raise ValueError('Informe a matricula.')
        return cleaned


class ProfessorRegisterRequest(BaseModel):
    registration_code: str = Field(..., min_length=5, max_length=5, description='Codigo de matricula de 5 digitos')
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=2, max_length=200)
    email: str = Field(..., max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    academic_course_names: List[str] = Field(default=[])

    @field_validator('registration_code')
    @classmethod
    def validate_registration_code(cls, value: str) -> str:
        digits = digits_only(value, 5) or ''
        if len(digits) != 5:
            raise ValueError('O codigo de matricula deve ter exatamente 5 digitos.')
        return digits

    @field_validator('email')
    @classmethod
    def validate_email(cls, value: str) -> str:
        return validate_email_value(value)

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, value: Optional[str]) -> Optional[str]:
        return validate_phone_value(value)

    @field_validator('academic_course_names')
    @classmethod
    def validate_course_names(cls, values: List[str]) -> List[str]:
        cleaned = []
        seen = set()
        for value in values or []:
            name = str(value or '').strip()
            key = name.casefold()
            if name and key not in seen:
                cleaned.append(name)
                seen.add(key)
        if not cleaned:
            raise ValueError('Selecione ao menos um curso academico.')
        return cleaned


class LoginResponse(BaseModel):
    authenticated: bool = True
    token_type: str = 'session_cookie'
    role: str
    username: str
    expires_in_seconds: int


class SessionInfoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_identifier: str
    device_label: Optional[str] = None
    device_id: Optional[str] = None
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    refresh_expires_at: datetime
    access_expires_at: datetime
    last_seen_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    revoked_reason: Optional[str] = None
    is_current: bool = False


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    email: str
    role: str
    is_active: bool
