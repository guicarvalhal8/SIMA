"""Schemas Pydantic para Course (Disciplina)."""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


class CourseCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    code: str = Field(..., min_length=3, max_length=20)
    credits: int = Field(default=4, ge=1, le=20)
    semester: str = Field(..., max_length=10)
    department: str = Field(..., max_length=100)


class CourseUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    credits: Optional[int] = Field(None, ge=1, le=20)
    semester: Optional[str] = Field(None, max_length=10)
    department: Optional[str] = Field(None, max_length=100)


class CourseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    credits: int
    semester: str
    department: str


class CourseListResponse(BaseModel):
    total: int
    courses: list[CourseResponse]

