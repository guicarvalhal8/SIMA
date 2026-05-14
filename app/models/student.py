"""
Modelo de Aluno (Student).

Representa um estudante matriculado na instituição.
Encapsula dados pessoais e acadêmicos.
"""

from sqlalchemy import Column, String, Integer, Boolean, Date, DateTime, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import relationship
import enum

from app.models.base import BaseModel


class StudentStatus(str, enum.Enum):
    """Status possíveis de um aluno na instituição."""
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    GRADUATED = "GRADUATED"
    SUSPENDED = "SUSPENDED"


class ClassSchedule(str, enum.Enum):
    """Turnos/Horários de aula."""
    MORNING = "MORNING"
    INTEGRAL = "INTEGRAL"
    AFTERNOON = "AFTERNOON"
    NIGHT = "NIGHT"


class Student(BaseModel):
    """
    Entidade Aluno.

    Atributos pessoais:
        name, age, cpf, gender, phone, email

    Atributos acadêmicos:
        registration_number, course_name, current_period,
        class_schedule, enrollment_date, status

    Atributos de trabalho:
        is_working, work_schedule

    Vínculo:
        user_id → FK para users.id (login do aluno)
    """
    __tablename__ = "students"

    # ── Vínculo com User ──
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=True, index=True)

    # ── Dados Pessoais ──
    name = Column(String(200), nullable=False, index=True)
    age = Column(Integer, nullable=True)
    cpf = Column(String(14), unique=True, nullable=True)
    gender = Column(String(20), nullable=True)  # masculino, feminino, outro
    phone = Column(String(20), nullable=True)
    email = Column(String(200), unique=True, nullable=False)

    # ── Dados Acadêmicos ──
    registration_number = Column(String(20), unique=True, nullable=False, index=True)
    course_name = Column(String(200), nullable=True)  # ex: "Engenharia de Software"
    current_period = Column(Integer, nullable=True)  # 1 a 10
    class_schedule = Column(
        SAEnum(ClassSchedule),
        nullable=True,
    )
    enrollment_date = Column(Date, nullable=False)
    status = Column(
        SAEnum(StudentStatus),
        default=StudentStatus.ACTIVE,
        nullable=False,
    )

    # ── Trabalho ──
    is_working = Column(Boolean, default=False, nullable=True)
    work_schedule = Column(String(100), nullable=True)  # ex: "08:00 às 17:00"

    # ── Sincronização Lyceum ──
    lyceum_password = Column(String(200), nullable=True)  # Senha do portal Lyceum
    last_sync_at = Column(DateTime, nullable=True)  # Última sincronização
    sync_status = Column(String(20), default="idle", nullable=False)  # idle, syncing, done, error
    sync_error = Column(String(500), nullable=True)  # Mensagem de erro da última sync

    # ── Relacionamentos ──
    enrollments = relationship("Enrollment", back_populates="student", cascade="all, delete-orphan")
    grades = relationship("Grade", back_populates="student", cascade="all, delete-orphan")
    attendances = relationship("Attendance", back_populates="student", cascade="all, delete-orphan")
    scraped_grades = relationship("ScrapedGrade", back_populates="student", cascade="all, delete-orphan")
    scraped_attendance = relationship("ScrapedAttendance", back_populates="student", cascade="all, delete-orphan")
    scraped_subjects = relationship("ScrapedSubject", back_populates="student", cascade="all, delete-orphan")
    scraped_schedule = relationship("ScrapedSchedule", back_populates="student", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Student(id={self.id}, name='{self.name}', reg='{self.registration_number}')>"
