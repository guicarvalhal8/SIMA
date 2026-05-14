"""
Modelos para dados acadêmicos extraídos via web scraping do Lyceum.

Armazena notas, frequência, disciplinas e horários obtidos
diretamente do portal da UniEvangélica.
"""

from sqlalchemy import Column, String, Integer, Float, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class ScrapedGrade(BaseModel):
    """Nota extraída do Lyceum via scraping."""
    __tablename__ = "scraped_grades"

    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    disciplina = Column(String(300), nullable=False)
    va1 = Column(Float, default=0.0)
    va2 = Column(Float, default=0.0)
    va3 = Column(Float, default=0.0)
    media = Column(Float, default=0.0)
    situacao = Column(String(50), default="Cursando")
    avaliacoes = Column(Text, nullable=True)  # JSON com lista de avaliações detalhadas

    # ── Relacionamento ──
    student = relationship("Student", back_populates="scraped_grades")

    def __repr__(self) -> str:
        return f"<ScrapedGrade(student={self.student_id}, disc='{self.disciplina}', media={self.media})>"


class ScrapedAttendance(BaseModel):
    """Frequência/faltas extraídas do Lyceum via scraping."""
    __tablename__ = "scraped_attendance"

    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    disciplina = Column(String(300), nullable=False)
    total_faltas = Column(Integer, default=0)
    total_aulas = Column(Integer, default=60)
    percentual_presenca = Column(Float, default=100.0)

    # ── Relacionamento ──
    student = relationship("Student", back_populates="scraped_attendance")

    def __repr__(self) -> str:
        return f"<ScrapedAttendance(student={self.student_id}, disc='{self.disciplina}', faltas={self.total_faltas})>"


class ScrapedSubject(BaseModel):
    """Disciplina extraída do Lyceum via scraping."""
    __tablename__ = "scraped_subjects"

    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    disciplina = Column(String(300), nullable=False)
    situacao = Column(String(50), default="Matriculado")
    periodo = Column(String(100), nullable=True)
    docente = Column(String(200), nullable=True)
    data_inicial = Column(String(20), nullable=True)

    # ── Relacionamento ──
    student = relationship("Student", back_populates="scraped_subjects")

    def __repr__(self) -> str:
        return f"<ScrapedSubject(student={self.student_id}, disc='{self.disciplina}')>"


class ScrapedSchedule(BaseModel):
    """Horário de aula extraído do Lyceum via scraping."""
    __tablename__ = "scraped_schedule"

    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    dia_semana = Column(Integer, nullable=False)  # 0=Dom, 1=Seg, ..., 6=Sab
    dia_nome = Column(String(20), nullable=True)
    disciplina = Column(String(300), nullable=False)
    horario_inicio = Column(String(10), nullable=True)
    horario_fim = Column(String(10), nullable=True)
    local = Column(String(200), nullable=True)
    professor = Column(String(200), nullable=True)

    # ── Relacionamento ──
    student = relationship("Student", back_populates="scraped_schedule")

    def __repr__(self) -> str:
        return f"<ScrapedSchedule(student={self.student_id}, dia={self.dia_semana}, disc='{self.disciplina}')>"
