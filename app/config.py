"""
Configurações centrais do sistema.
Utiliza pydantic-settings para carregar variáveis de ambiente.
"""

from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from pathlib import Path


class Settings(BaseSettings):
    """Configurações da aplicação carregadas via variáveis de ambiente."""

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    # ── Aplicação ──
    APP_NAME: str = "Sistema de Monitoramento Acadêmico"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # ── Banco de Dados ──
    DATABASE_URL: str = "sqlite:///./academico.db"

    # ── Segurança / JWT ──
    SECRET_KEY: str = "chave-secreta-desenvolvimento-trocar-em-producao"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── Caminhos ──
    BASE_DIR: Path = Path(__file__).resolve().parent

    # ── Gemini AI ──
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"


settings = Settings()
