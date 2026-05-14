"""
Modelo de Coordenador (Coordinator).

Representa um coordenador de curso vinculado ao sistema.
O coordenador tem acesso a todos os alunos e disciplinas do curso que coordena.
"""

from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Coordinator(BaseModel):
    """
    Entidade Coordenador.

    Atributos:
        user_id: FK para users.id (vínculo com login)
        phone: telefone de contato
        academic_course_name: nome do curso que coordena (ex: "Inteligência Artificial")

    Relacionamentos:
        user: User vinculado
    """
    __tablename__ = "coordinators"

    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    academic_course_name = Column(String(200), nullable=False)

    # Relacionamentos
    user = relationship("User", backref="coordinator_profile", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<Coordinator(id={self.id}, user_id={self.user_id}, course='{self.academic_course_name}')>"
