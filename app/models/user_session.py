"""
Sessões autenticadas por dispositivo/navegador.

Mantém refresh token rotativo e permite revogação por sessão.
"""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text

from app.models.base import BaseModel


class UserSession(BaseModel):
    """Sessão autenticada persistida no servidor."""

    __tablename__ = "user_sessions"

    user_id = Column(ForeignKey("users.id"), nullable=False, index=True)
    session_identifier = Column(String(64), nullable=False, unique=True, index=True)
    refresh_token_hash = Column(String(128), nullable=False, unique=True, index=True)
    previous_refresh_token_hash = Column(String(128), nullable=True, index=True)
    current_access_jti = Column(String(64), nullable=False, index=True)
    device_id = Column(String(128), nullable=True, index=True)
    device_label = Column(String(200), nullable=True)
    user_agent = Column(Text, nullable=True)
    ip_address = Column(String(100), nullable=True)
    refresh_expires_at = Column(DateTime, nullable=False)
    access_expires_at = Column(DateTime, nullable=False)
    last_seen_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    revoked_reason = Column(String(120), nullable=True)
    is_current = Column(Boolean, default=True, nullable=False)
