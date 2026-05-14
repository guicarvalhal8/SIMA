"""
Classe base para todos os modelos ORM do sistema.
Implementa campos comuns e comportamento compartilhado.
"""

from datetime import datetime, timezone

from sqlalchemy import Column, Integer, DateTime
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base declarativa do SQLAlchemy para todos os modelos."""
    pass


class BaseModel(Base):
    """
    Modelo abstrato com campos comuns a todas as entidades.

    Fornece:
        - id: chave primária autoincremental
        - created_at: timestamp de criação
        - updated_at: timestamp de última atualização
        - to_dict(): serialização para dicionário
    """
    __abstract__ = True

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def to_dict(self) -> dict:
        """Serializa o modelo para dicionário, excluindo atributos internos."""
        return {
            col.name: getattr(self, col.name)
            for col in self.__table__.columns
        }

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(id={self.id})>"
