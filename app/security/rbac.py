"""
Controle de acesso baseado em papéis (RBAC).

Fornece dependencies do FastAPI para restringir endpoints
a papéis específicos de usuário.
"""

from functools import wraps
from typing import List

from fastapi import Depends, HTTPException, status

from app.models.user import User, UserRole
from app.security.auth import get_current_user


def require_role(*allowed_roles: UserRole):
    """
    Dependency factory que restringe acesso a papéis permitidos.

    Uso:
        @router.get("/admin-only", dependencies=[Depends(require_role(UserRole.ADMIN))])

    Args:
        allowed_roles: papéis que têm permissão de acesso.

    Returns:
        Dependency do FastAPI que valida o papel do usuário.
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acesso negado. Papéis permitidos: {[r.value for r in allowed_roles]}",
            )
        return current_user
    return role_checker


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency que restringe acesso apenas a administradores."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores",
        )
    return current_user


def require_coordinator_or_above(current_user: User = Depends(get_current_user)) -> User:
    """Dependency que restringe acesso a coordenadores e administradores."""
    if current_user.role not in (UserRole.ADMIN, UserRole.COORDINATOR):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a coordenadores e administradores",
        )
    return current_user
