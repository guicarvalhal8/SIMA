"""Schemas Pydantic para autenticação e registro."""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Union


class LoginRequest(BaseModel):
    identifier: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=4)


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    full_name: str = Field(..., min_length=2, max_length=200)
    email: str = Field(..., max_length=200)
    password: str = Field(..., min_length=6)
    role: str = Field(default="viewer")


# ── Registro de Aluno ──
class StudentRegisterRequest(BaseModel):
    """Dados completos para cadastro de aluno."""
    # Credenciais
    password: str = Field(..., min_length=6)

    # Dados pessoais
    name: str = Field(..., min_length=2, max_length=200)
    age: Optional[int] = Field(None, ge=14, le=100)
    email: str = Field(..., max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    gender: Optional[str] = Field(None, max_length=20)
    cpf: str = Field(..., min_length=11, max_length=14)

    # Dados acadêmicos
    registration_number: str = Field(..., min_length=3, max_length=20)
    course_name: Optional[str] = Field(None, max_length=200)
    current_period: Optional[int] = Field(None, ge=1, le=12)
    class_schedule: Optional[str] = Field(None)  # matutino, integral, noturno

    # Trabalho
    is_working: Optional[bool] = Field(default=False)
    work_schedule: Optional[str] = Field(None, max_length=100)

    # Credenciais do portal Lyceum (para sincronização de dados)
    lyceum_password: Optional[str] = Field(None, max_length=200)


# ── Registro de Professor ──
class ProfessorRegisterRequest(BaseModel):
    """Dados para cadastro de professor."""
    # Código de matrícula (5 dígitos) - também serve como username
    registration_code: str = Field(..., min_length=5, max_length=5, description="Código de matrícula de 5 dígitos")

    # Credenciais
    password: str = Field(..., min_length=6)

    # Dados pessoais
    name: str = Field(..., min_length=2, max_length=200)
    email: str = Field(..., max_length=200)
    phone: Optional[str] = Field(None, max_length=20)

    # Disciplinas que leciona (IDs inteiros ou nomes de disciplinas scraping)
    course_ids: List[Union[int, str]] = Field(default=[])

    # Nomes dos cursos acadêmicos (ex: "Inteligência Artificial")
    academic_course_names: List[str] = Field(default=[])


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    email: str
    role: str
    is_active: bool
