"""
Modelo de Professor (Professor).

Representa um professor vinculado ao sistema, com informações de contato
e associação com disciplinas (courses) que leciona.
"""

from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Professor(BaseModel):
    """
    Entidade Professor.

    Atributos:
        user_id: FK para users.id (vínculo com login)
        phone: telefone de contato

    Relacionamentos:
        user: User vinculado
        professor_courses: disciplinas que leciona
    """
    __tablename__ = "professors"

    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True)

    # Relacionamentos
    user = relationship("User", backref="professor_profile", foreign_keys=[user_id])
    professor_courses = relationship(
        "ProfessorCourse", back_populates="professor", cascade="all, delete-orphan"
    )
    academic_courses = relationship(
        "ProfessorAcademicCourse", back_populates="professor", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Professor(id={self.id}, user_id={self.user_id})>"


class ProfessorAcademicCourse(BaseModel):
    """
    Associação Professor-Curso Acadêmico.
    Relaciona um professor a um curso de nível superior (ex: "Inteligência Artificial").
    """
    __tablename__ = "professor_academic_courses"

    professor_id = Column(Integer, ForeignKey("professors.id"), nullable=False, index=True)
    course_name = Column(String(200), nullable=False)

    # Relacionamentos
    professor = relationship("Professor", back_populates="academic_courses")

    def __repr__(self) -> str:
        return f"<ProfessorAcademicCourse(professor={self.professor_id}, course='{self.course_name}')>"


class ProfessorCourse(BaseModel):
    """
    Associação Professor-Disciplina.

    Relaciona um professor a uma disciplina (course) que ele leciona.
    """
    __tablename__ = "professor_courses"

    professor_id = Column(Integer, ForeignKey("professors.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)

    # ── Relacionamentos ──
    professor = relationship("Professor", back_populates="professor_courses")
    course = relationship("Course")

    def __repr__(self) -> str:
        return f"<ProfessorCourse(professor={self.professor_id}, course={self.course_id})>"
