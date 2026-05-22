"""
Serviços de sessão persistida com refresh token rotativo.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
import hashlib
import secrets
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.models.user_session import UserSession


def utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def build_device_label(request: Request) -> str:
    explicit_label = (request.headers.get("X-Device-Label") or "").strip()
    if explicit_label:
        return explicit_label[:200]

    browser = (request.headers.get("sec-ch-ua-platform") or "").strip('" ')
    user_agent = (request.headers.get("user-agent") or "").strip()
    if browser and user_agent:
        return f"{browser} - navegador web"
    if user_agent:
        return user_agent[:200]
    return "Sessao web"


def get_device_id(request: Request) -> Optional[str]:
    device_id = (request.headers.get("X-Device-Id") or "").strip()
    return device_id[:128] if device_id else None


def get_client_ip(request: Request) -> Optional[str]:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()[:100]
    if request.client and request.client.host:
        return request.client.host[:100]
    return None


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(64)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session_payload(user: User) -> tuple[str, str]:
    return uuid4().hex, uuid4().hex


def create_user_session(
    db: Session,
    user: User,
    request: Request,
    refresh_token: str,
    session_identifier: str,
    access_jti: str,
) -> UserSession:
    now = utc_now()
    session = UserSession(
        user_id=user.id,
        session_identifier=session_identifier,
        refresh_token_hash=hash_refresh_token(refresh_token),
        current_access_jti=access_jti,
        device_id=get_device_id(request),
        device_label=build_device_label(request),
        user_agent=(request.headers.get("user-agent") or "")[:2000] or None,
        ip_address=get_client_ip(request),
        refresh_expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        access_expires_at=now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        last_seen_at=now,
        is_current=True,
    )
    db.add(session)
    db.flush()
    trim_active_sessions(db, user.id)
    return session


def trim_active_sessions(db: Session, user_id: int) -> None:
    active_sessions = (
        db.query(UserSession)
        .filter(
            UserSession.user_id == user_id,
            UserSession.revoked_at.is_(None),
        )
        .order_by(UserSession.last_seen_at.desc(), UserSession.created_at.desc())
        .all()
    )
    for stale_session in active_sessions[settings.MAX_ACTIVE_SESSIONS_PER_USER:]:
        revoke_session(stale_session, "session_limit")


def revoke_session(session: UserSession, reason: str) -> None:
    session.revoked_at = utc_now()
    session.revoked_reason = reason[:120]
    session.is_current = False


def revoke_all_user_sessions(db: Session, user_id: int, reason: str, keep_session_id: Optional[str] = None) -> int:
    sessions = (
        db.query(UserSession)
        .filter(
            UserSession.user_id == user_id,
            UserSession.revoked_at.is_(None),
        )
        .all()
    )
    revoked_count = 0
    for session in sessions:
        if keep_session_id and session.session_identifier == keep_session_id:
            continue
        revoke_session(session, reason)
        revoked_count += 1
    return revoked_count


def find_refresh_session(db: Session, refresh_token: str) -> Optional[UserSession]:
    token_hash = hash_refresh_token(refresh_token)
    return (
        db.query(UserSession)
        .filter(UserSession.refresh_token_hash == token_hash)
        .first()
    )


def rotate_refresh_session(session: UserSession, request: Request, new_refresh_token: str, new_access_jti: str) -> None:
    session.previous_refresh_token_hash = session.refresh_token_hash
    session.refresh_token_hash = hash_refresh_token(new_refresh_token)
    session.current_access_jti = new_access_jti
    session.access_expires_at = utc_now() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    session.refresh_expires_at = utc_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    session.last_seen_at = utc_now()
    session.ip_address = get_client_ip(request)
    session.user_agent = (request.headers.get("user-agent") or "")[:2000] or session.user_agent
    session.device_label = build_device_label(request)
    session.device_id = get_device_id(request)
    session.is_current = True


def validate_refresh_session(db: Session, refresh_token: Optional[str]) -> UserSession:
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token ausente")

    token_hash = hash_refresh_token(refresh_token)
    session = (
        db.query(UserSession)
        .filter(
            (UserSession.refresh_token_hash == token_hash)
            | (UserSession.previous_refresh_token_hash == token_hash)
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessao invalida")

    if session.previous_refresh_token_hash == token_hash:
        revoke_session(session, "refresh_reuse_detected")
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessao comprometida por reutilizacao de refresh token")

    if session.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessao revogada")

    if session.refresh_expires_at <= utc_now():
        revoke_session(session, "refresh_expired")
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessao expirada")

    return session


def validate_access_session(db: Session, session_identifier: Optional[str], access_jti: Optional[str]) -> UserSession:
    if not session_identifier or not access_jti:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessao de acesso invalida")

    session = (
        db.query(UserSession)
        .filter(UserSession.session_identifier == session_identifier)
        .first()
    )
    if not session or session.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessao revogada")
    if session.current_access_jti != access_jti:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de acesso revogado")
    if session.refresh_expires_at <= utc_now():
        revoke_session(session, "refresh_expired")
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessao expirada")

    session.last_seen_at = utc_now()
    return session
