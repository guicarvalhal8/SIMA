"""
Modelo de dados para planilhas históricas de desempenho subidas no sistema (HistoricalSpreadsheet).
"""

from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class HistoricalSpreadsheet(BaseModel):
    """
    Entidade representativa de um arquivo de planilha histórica processado e armazenado.
    """

    __tablename__ = "historical_spreadsheets"

    filename = Column(String(255), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    semester = Column(String(50), nullable=True, index=True)
    course_name = Column(String(255), nullable=True, index=True)

    # Estatísticas agregadas locais da planilha para otimização de consultas
    records_count = Column(Integer, default=0, nullable=False)
    avg_grade = Column(Float, nullable=True)
    avg_attendance = Column(Float, nullable=True)

    # Dono da planilha
    professor_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Indicação se a planilha está em andamento (incompleta) ou se já foi concluída
    is_completed = Column(Boolean, default=True, nullable=False, server_default="true")

    # Relacionamentos
    professor = relationship("User")
    records = relationship(
        "HistoricalRecord",
        back_populates="spreadsheet",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<HistoricalSpreadsheet(id={self.id}, filename='{self.filename}', uploaded_at={self.uploaded_at})>"
