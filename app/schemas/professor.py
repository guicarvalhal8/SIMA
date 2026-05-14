"""Schemas Pydantic para Professor."""

from pydantic import BaseModel, ConfigDict
from typing import Optional, List


class ProfessorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    phone: Optional[str] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    courses: List[dict] = []




class ProfessorStudentResponse(BaseModel):
    """Aluno na visão do professor, agrupado por matéria e período."""
    student_id: int
    student_name: str
    registration_number: str
    course_name: Optional[str] = None
    current_period: Optional[int] = None
    class_schedule: Optional[str] = None


class ProfessorSubjectStudents(BaseModel):
    """Alunos de uma matéria específica do professor."""
    course_id: int
    course_name: str
    course_code: str
    students: List[ProfessorStudentResponse] = []
