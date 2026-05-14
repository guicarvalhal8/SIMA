from pydantic import BaseModel
from typing import Optional, Dict, List, Any
from datetime import datetime


class HistoricalRecordBase(BaseModel):
    semester: str
    course_name: str
    subject: Optional[str] = None
    period: Optional[int] = None
    student_name: str
    grades: Optional[Dict[str, Any]] = None
    attendance: Optional[float] = None


class HistoricalRecordCreate(HistoricalRecordBase):
    pass


class HistoricalRecordResponse(HistoricalRecordBase):
    id: int
    professor_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class HistoricalUploadResponse(BaseModel):
    message: str
    records_count: int
    semester: str
    course_organized: bool
