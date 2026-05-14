"""
Modelo de Dados Históricos (HistoricalData).

Armazena dados de semestres passados para análise e predição.
"""

from sqlalchemy import Column, String, Integer, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class HistoricalRecord(BaseModel):
    """
    Entidade de Registro Histórico.
    
    Representa dados extraídos de planilhas de semestres anteriores.
    """
    __tablename__ = "historical_records"

    semester = Column(String(20), nullable=False, index=True)  # ex: "2024-1"
    course_name = Column(String(200), nullable=False, index=True)  # ex: "Engenharia de Software"
    subject = Column(String(200), nullable=True, index=True)      # ex: "Algoritmos"
    period = Column(Integer, nullable=True)  # ex: 1, 2, 3...
    student_name = Column(String(200), nullable=False)
    
    # Armazena notas de forma flexível (ex: {"P1": 8.5, "P2": 7.0})
    grades = Column(JSON, nullable=True)
    
    attendance = Column(Float, nullable=True)
    
    # Quem subiu o arquivo
    professor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    def __repr__(self) -> str:
        return f"<HistoricalRecord(id={self.id}, semester='{self.semester}', student='{self.student_name}')>"
