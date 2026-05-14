"""
Modelo de Nota (Grade).

Representa uma avaliação atribuída a um aluno em uma disciplina.
Suporta diferentes tipos de avaliação com pesos configuráveis.
"""

from sqlalchemy import Column, Integer, Float, String, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
import enum

from app.models.base import BaseModel


class AssessmentType(str, enum.Enum):
    """Tipos de avaliação suportados."""
    EXAM = "EXAM"
    ASSIGNMENT = "ASSIGNMENT"
    PROJECT = "PROJECT"
    QUIZ = "QUIZ"
    PARTICIPATION = "PARTICIPATION"


class Grade(BaseModel):
    """
    Entidade Nota.

    Atributos:
        student_id: FK para o aluno avaliado
        course_id: FK para a disciplina
        value: nota de 0.0 a 10.0
        weight: peso da avaliação (0.0 a 1.0)
        assessment_type: tipo da avaliação
        description: descrição opcional (ex: "Prova 1")
    """
    __tablename__ = "grades"

    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    value = Column(Float, nullable=False)
    weight = Column(Float, nullable=False, default=1.0)
    assessment_type = Column(
        SAEnum(AssessmentType),
        default=AssessmentType.EXAM,
        nullable=False,
    )
    description = Column(String(200), nullable=True)

    # ── Relacionamentos ──
    student = relationship("Student", back_populates="grades")
    course = relationship("Course", back_populates="grades")

    def __repr__(self) -> str:
        return f"<Grade(student={self.student_id}, course={self.course_id}, value={self.value})>"
