"""Schemas Pydantic para Coordenador."""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List


class CoordinatorRegisterRequest(BaseModel):
    """Dados para cadastro de coordenador."""
    registration_code: str = Field(..., min_length=5, max_length=5, description="Código de matrícula de 5 dígitos")
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=2, max_length=200)
    email: str = Field(..., max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    academic_course_name: str = Field(..., min_length=2, max_length=200)


class CoordinatorProfileResponse(BaseModel):
    """Perfil do coordenador."""
    id: int
    user_id: int
    phone: Optional[str] = None
    user_name: str
    user_email: str
    academic_course_name: str


class CoordinatorStudentResponse(BaseModel):
    """Aluno na visão do coordenador."""
    student_id: int
    student_name: str
    registration_number: str
    course_name: Optional[str] = None
    current_period: Optional[int] = None
    class_schedule: Optional[str] = None


class CoordinatorSubjectStudents(BaseModel):
    """Alunos de uma matéria do curso do coordenador."""
    course_id: int
    course_name: str
    course_code: str
    students: List[CoordinatorStudentResponse] = []
