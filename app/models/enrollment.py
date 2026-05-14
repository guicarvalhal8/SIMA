"""
Modelo de Matrícula (Enrollment).

Representa a relação muitos-para-muitos entre Aluno e Disciplina,
com atributos adicionais como semestre e status da matrícula.
"""

from sqlalchemy import Column, Integer, String, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
import enum

from app.models.base import BaseModel


class EnrollmentStatus(str, enum.Enum):
    """Status da matrícula em uma disciplina."""
    ENROLLED = "ENROLLED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    WITHDRAWN = "WITHDRAWN"


class Enrollment(BaseModel):
    """
    Entidade Matrícula — associa Student a Course.

    Atributos:
        student_id: FK para o aluno
        course_id: FK para a disciplina
        semester: semestre da matrícula (ex: "2025.1")
        status: situação (enrolled, completed, failed, withdrawn)
    """
    __tablename__ = "enrollments"

    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    semester = Column(String(10), nullable=False)
    status = Column(
        SAEnum(EnrollmentStatus),
        default=EnrollmentStatus.ENROLLED,
        nullable=False,
    )

    # ── Relacionamentos ──
    student = relationship("Student", back_populates="enrollments")
    course = relationship("Course", back_populates="enrollments")

    def __repr__(self) -> str:
        return f"<Enrollment(student={self.student_id}, course={self.course_id}, status='{self.status}')>"
