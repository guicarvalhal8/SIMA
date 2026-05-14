"""
Modelo de Disciplina (Course).

Representa uma disciplina ofertada pela instituição.
"""

from sqlalchemy import Column, String, Integer
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Course(BaseModel):
    """
    Entidade Disciplina.

    Atributos:
        name: nome da disciplina
        code: código único (ex: "MAT101")
        credits: carga horária em créditos
        semester: semestre de oferta (ex: "2025.1")
        department: departamento responsável
    """
    __tablename__ = "courses"

    name = Column(String(200), nullable=False)
    code = Column(String(20), unique=True, nullable=False, index=True)
    credits = Column(Integer, nullable=False, default=4)
    semester = Column(String(10), nullable=False)
    department = Column(String(100), nullable=False)

    # ── Relacionamentos ──
    enrollments = relationship("Enrollment", back_populates="course", cascade="all, delete-orphan")
    grades = relationship("Grade", back_populates="course", cascade="all, delete-orphan")
    attendances = relationship("Attendance", back_populates="course", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Course(id={self.id}, code='{self.code}', name='{self.name}')>"
