"""
Modelo de Frequência (Attendance).

Registra a presença de alunos em aulas de cada disciplina.
"""

from sqlalchemy import Column, Integer, Date, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
import enum

from app.models.base import BaseModel


class AttendanceStatus(str, enum.Enum):
    """Status de presença em uma aula."""
    PRESENT = "present"
    ABSENT = "absent"
    JUSTIFIED = "justified"
    LATE = "late"


class Attendance(BaseModel):
    """
    Entidade Frequência.

    Atributos:
        student_id: FK para o aluno
        course_id: FK para a disciplina
        date: data da aula
        status: presença, falta, justificada ou atraso
    """
    __tablename__ = "attendances"

    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    date = Column(Date, nullable=False)
    status = Column(
        SAEnum(AttendanceStatus),
        default=AttendanceStatus.PRESENT,
        nullable=False,
    )

    # ── Relacionamentos ──
    student = relationship("Student", back_populates="attendances")
    course = relationship("Course", back_populates="attendances")

    def __repr__(self) -> str:
        return f"<Attendance(student={self.student_id}, course={self.course_id}, date={self.date}, status='{self.status}')>"
