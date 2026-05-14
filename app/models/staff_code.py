"""
Modelo de Código de Matrícula de Funcionários (StaffRegistrationCode).

Armazena códigos de matrícula válidos para professores e coordenadores.
O cadastro só é aceito quando o código informado corresponde a um código
válido e ainda não utilizado nesta tabela.
"""

from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, Enum as SAEnum
import enum

from app.models.base import BaseModel


class StaffRole(str, enum.Enum):
    """Papel que o código de matrícula desbloqueia."""
    PROFESSOR = "PROFESSOR"
    COORDINATOR = "COORDINATOR"


class StaffRegistrationCode(BaseModel):
    """
    Código de matrícula fictício para professores e coordenadores.

    Atributos:
        code: código numérico de 5 dígitos (único)
        role: papel que este código desbloqueia (PROFESSOR ou COORDINATOR)
        is_used: se o código já foi utilizado em um cadastro
        used_by_user_id: FK para users.id de quem utilizou o código
    """
    __tablename__ = "staff_registration_codes"

    code = Column(String(5), unique=True, nullable=False, index=True)
    role = Column(SAEnum(StaffRole), nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    used_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    def __repr__(self) -> str:
        return f"<StaffRegistrationCode(code='{self.code}', role='{self.role}', used={self.is_used})>"
