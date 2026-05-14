"""Schemas Pydantic para Attendance (Frequência)."""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import date


class AttendanceCreate(BaseModel):
    student_id: int
    course_id: int
    date: date
    status: str = Field(default="present")


class AttendanceUpdate(BaseModel):
    status: Optional[str] = None


class AttendanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    course_id: int
    date: date
    status: str


class AttendanceListResponse(BaseModel):
    total: int
    attendances: list[AttendanceResponse]

