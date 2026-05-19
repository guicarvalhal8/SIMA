"""Schemas Pydantic para Coordenador."""

from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List

from app.schemas.validators import digits_only, validate_email_value, validate_phone_value


class CoordinatorRegisterRequest(BaseModel):
    """Dados para cadastro de coordenador."""
    registration_code: str = Field(..., min_length=5, max_length=5, description="Codigo de matricula de 5 digitos")
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=2, max_length=200)
    email: str = Field(..., max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    academic_course_name: str = Field(..., min_length=2, max_length=200)

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

    @field_validator('academic_course_name')
    @classmethod
    def validate_course_name(cls, value: str) -> str:
        cleaned = str(value or '').strip()
        if len(cleaned) < 2:
            raise ValueError('Selecione o curso que voce coordena.')
        return cleaned


class CoordinatorProfileResponse(BaseModel):
    """Perfil do coordenador."""
    id: int
    user_id: int
    phone: Optional[str] = None
    user_name: str
    user_email: str
    academic_course_name: str


class CoordinatorStudentResponse(BaseModel):
    """Aluno na visao do coordenador."""
    student_id: int
    student_name: str
    registration_number: str
    course_name: Optional[str] = None
    current_period: Optional[int] = None
    class_schedule: Optional[str] = None


class CoordinatorSubjectStudents(BaseModel):
    """Alunos de uma materia do curso do coordenador."""
    course_id: int
    course_name: str
    course_code: str
    students: List[CoordinatorStudentResponse] = []
