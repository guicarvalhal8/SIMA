"""Schemas Pydantic para Grade (Nota)."""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


class GradeCreate(BaseModel):
    student_id: int
    course_id: int
    value: float = Field(..., ge=0.0, le=10.0)
    weight: float = Field(default=1.0, ge=0.0, le=1.0)
    assessment_type: str = Field(default="exam")
    description: Optional[str] = Field(None, max_length=200)


class GradeUpdate(BaseModel):
    value: Optional[float] = Field(None, ge=0.0, le=10.0)
    weight: Optional[float] = Field(None, ge=0.0, le=1.0)
    description: Optional[str] = Field(None, max_length=200)


class GradeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    course_id: int
    value: float
    weight: float
    assessment_type: str
    description: Optional[str]


class GradeListResponse(BaseModel):
    total: int
    grades: list[GradeResponse]

