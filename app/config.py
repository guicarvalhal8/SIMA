"""
Configuracoes centrais do sistema.

Carrega variaveis de ambiente via pydantic-settings e concentra
defaults seguros para desenvolvimento local.
"""

from __future__ import annotations

import secrets
from pathlib import Path
from typing import List

from pydantic import ConfigDict, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuracoes da aplicacao carregadas via variaveis de ambiente."""

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Aplicacao
    APP_NAME: str = "NEXORA API"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Banco de Dados
    DATABASE_URL: str = "sqlite:///./academico.db"
    AUTO_CREATE_SCHEMA: bool = False

    # Seguranca / JWT
    SECRET_KEY: str = Field(default_factory=lambda: secrets.token_urlsafe(64))
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    LYCEUM_CREDENTIALS_KEY: str = ""
    ACCESS_COOKIE_NAME: str = "nexora_access"
    REFRESH_COOKIE_NAME: str = "nexora_refresh"
    SESSION_COOKIE_SECURE: bool = False
    SESSION_COOKIE_SAMESITE: str = "lax"
    SESSION_COOKIE_DOMAIN: str = ""
    MAX_ACTIVE_SESSIONS_PER_USER: int = 5

    # Uploads
    MAX_UPLOAD_BYTES: int = 8 * 1024 * 1024
    MAX_HISTORICAL_RECORDS_PER_FILE: int = 5000
    ENABLE_GEMINI_UPLOAD_FALLBACK: bool = True

    # Scraping
    ALLOW_LYCEUM_CPF_PASSWORD_FALLBACK: bool = False

    # Bootstrap / demo
    ENABLE_DEMO_BOOTSTRAP: bool = False
    SEED_EMPTY_DATABASE: bool = False
    CREATE_DEFAULT_ADMIN: bool = False
    DEFAULT_ADMIN_USERNAME: str = "admin"
    DEFAULT_ADMIN_EMAIL: str = "admin@nexora.local"
    DEFAULT_ADMIN_PASSWORD: str = ""
    ENABLE_STARTUP_DATA_REPAIR: bool = True

    # CORS
    CORS_ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    CORS_ALLOW_CREDENTIALS: bool = True

    # Caminhos
    BASE_DIR: Path = Path(__file__).resolve().parent

    # Gemini AI
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    @property
    def cors_allowed_origins(self) -> List[str]:
        raw = self.CORS_ALLOWED_ORIGINS.strip()
        if not raw:
            return []
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


settings = Settings()
