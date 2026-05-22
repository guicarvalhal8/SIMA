"""
Modulo de autenticacao JWT, cookie HttpOnly e validacao de sessao persistida.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, Response, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.security.session import validate_access_session

bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Cria um token JWT assinado.

    Args:
        data: payload do token (deve conter "sub" com o username)
        expires_delta: tempo de expiracao personalizado

    Returns:
        Token JWT codificado como string.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str) -> dict:
    """
    Valida e decodifica um token JWT.

    Raises:
        HTTPException 401 se o token for invalido ou expirado.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalido ou expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        return payload
    except JWTError as exc:
        raise credentials_exception from exc


def _authentication_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Autenticacao obrigatoria",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_request_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(bearer_scheme),
) -> str:
    """Extrai token do header Authorization ou do cookie de sessao."""
    if credentials and credentials.scheme.lower() == "bearer" and credentials.credentials:
        return credentials.credentials

    session_token = request.cookies.get(settings.ACCESS_COOKIE_NAME)
    if session_token:
        return session_token

    raise _authentication_exception()


def set_session_cookie(response: Response, token: str) -> None:
    """Grava o token JWT em cookie HttpOnly para sessao web."""
    response.set_cookie(
        key=settings.ACCESS_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite=settings.SESSION_COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        domain=settings.SESSION_COOKIE_DOMAIN or None,
    )


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Grava o refresh token em cookie HttpOnly."""
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite=settings.SESSION_COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/",
        domain=settings.SESSION_COOKIE_DOMAIN or None,
    )


def clear_session_cookies(response: Response) -> None:
    """Remove os cookies de acesso e refresh da sessao atual."""
    for cookie_name in (settings.ACCESS_COOKIE_NAME, settings.REFRESH_COOKIE_NAME):
        response.delete_cookie(
            key=cookie_name,
            path="/",
            domain=settings.SESSION_COOKIE_DOMAIN or None,
            samesite=settings.SESSION_COOKIE_SAMESITE,
            secure=settings.SESSION_COOKIE_SECURE,
            httponly=True,
        )


def clear_session_cookie(response: Response) -> None:
    """Compatibilidade com chamadores legados."""
    clear_session_cookies(response)


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency do FastAPI que extrai o usuario autenticado a partir do token JWT.

    Returns:
        Instancia do modelo User correspondente ao token.

    Raises:
        HTTPException 401 se o token for invalido.
        HTTPException 401 se o usuario nao existir ou estiver inativo.
    """
    token = get_request_token(request, credentials)
    payload = verify_token(token)
    if payload.get("type") != "access":
        raise _authentication_exception()
    validate_access_session(
        db,
        payload.get("sid"),
        payload.get("jti"),
    )
    username = payload.get("sub")

    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario nao encontrado ou inativo",
        )
    return user
