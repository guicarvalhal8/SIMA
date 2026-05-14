"""
Modelo de Usuário do Sistema (User).

Representa um usuário com credenciais de acesso e papel (role).
Utilizado para autenticação JWT e controle de acesso RBAC.
"""

from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, Enum as SAEnum
import enum

from app.models.base import BaseModel


class UserRole(str, enum.Enum):
    """Papéis de acesso no sistema."""
    ADMIN = "ADMIN"
    COORDINATOR = "COORDINATOR"
    PROFESSOR = "PROFESSOR"
    STUDENT = "STUDENT"
    VIEWER = "VIEWER"


class User(BaseModel):
    """
    Entidade Usuário do sistema.

    Atributos:
        username: nome de login (único)
        full_name: nome completo
        email: e-mail (único)
        hashed_password: senha criptografada com bcrypt
        role: papel no sistema (admin, coordinator, professor, student, viewer)
        is_active: se a conta está ativa
        is_approved: se a conta foi aprovada pelo admin (False para professores pendentes)
    """
    __tablename__ = "users"

    username = Column(String(50), unique=True, nullable=False, index=True)
    full_name = Column(String(200), nullable=False)
    email = Column(String(200), unique=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    role = Column(
        SAEnum(UserRole),
        default=UserRole.VIEWER,
        nullable=False,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    is_approved = Column(Boolean, default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"
