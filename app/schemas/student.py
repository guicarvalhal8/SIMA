"""Schemas Pydantic para Student (Aluno)."""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import date


class StudentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    registration_number: str = Field(..., min_length=3, max_length=20)
    email: str = Field(..., max_length=200)
    enrollment_date: date
    status: str = Field(default="active")


class StudentUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    age: Optional[int] = Field(None, ge=14, le=100)
    gender: Optional[str] = Field(None, max_length=20)
    course_name: Optional[str] = Field(None, max_length=200)
    current_period: Optional[int] = Field(None, ge=1, le=12)
    class_schedule: Optional[str] = None
    is_working: Optional[bool] = None
    work_schedule: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = None


class StudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    registration_number: str
    email: str
    enrollment_date: date
    status: str
    age: Optional[int] = None
    cpf: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    course_name: Optional[str] = None
    current_period: Optional[int] = None
    class_schedule: Optional[str] = None
    is_working: Optional[bool] = None
    work_schedule: Optional[str] = None
    user_id: Optional[int] = None


class StudentListResponse(BaseModel):
    total: int
    students: list[StudentResponse]
