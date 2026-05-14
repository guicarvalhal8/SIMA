"""
Módulo de auditoria e logging.

Registra eventos de segurança, acessos à API e modificações de dados
em formato estruturado JSON para rastreabilidade.
"""

import logging
import json
from datetime import datetime, timezone
from typing import Optional


class AuditLogger:
    """
    Logger de auditoria com saída em formato JSON estruturado.

    Registra:
        - Tentativas de login (sucesso/falha)
        - Acessos a endpoints protegidos
        - Modificações de dados (CRUD)
        - Erros de autorização
    """

    def __init__(self, log_file: str = "audit.log"):
        self.logger = logging.getLogger("audit")
        self.logger.setLevel(logging.INFO)

        # Evita handlers duplicados
        if not self.logger.handlers:
            # Handler para arquivo
            file_handler = logging.FileHandler(log_file, encoding="utf-8")
            file_handler.setLevel(logging.INFO)

            # Handler para console
            console_handler = logging.StreamHandler()
            console_handler.setLevel(logging.WARNING)

            # Formato simples (o conteúdo já é JSON)
            formatter = logging.Formatter("%(message)s")
            file_handler.setFormatter(formatter)
            console_handler.setFormatter(formatter)

            self.logger.addHandler(file_handler)
            self.logger.addHandler(console_handler)

    def _log(self, level: str, event_type: str, message: str,
             user: Optional[str] = None, details: Optional[dict] = None):
        """Registra um evento estruturado."""
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "event_type": event_type,
            "message": message,
            "user": user,
            "details": details or {},
        }
        log_line = json.dumps(entry, ensure_ascii=False)

        if level == "WARNING":
            self.logger.warning(log_line)
        elif level == "ERROR":
            self.logger.error(log_line)
        else:
            self.logger.info(log_line)

    def log_login(self, username: str, success: bool, ip: Optional[str] = None):
        """Registra tentativa de login."""
        self._log(
            level="INFO" if success else "WARNING",
            event_type="AUTH_LOGIN",
            message=f"Login {'bem-sucedido' if success else 'falhou'} para {username}",
            user=username,
            details={"success": success, "ip": ip},
        )

    def log_access(self, username: str, endpoint: str, method: str):
        """Registra acesso a endpoint."""
        self._log(
            level="INFO",
            event_type="API_ACCESS",
            message=f"{method} {endpoint}",
            user=username,
            details={"endpoint": endpoint, "method": method},
        )

    def log_data_change(self, username: str, entity: str, action: str,
                        entity_id: Optional[int] = None):
        """Registra modificação de dados."""
        self._log(
            level="INFO",
            event_type="DATA_CHANGE",
            message=f"{action} em {entity} (id={entity_id})",
            user=username,
            details={"entity": entity, "action": action, "entity_id": entity_id},
        )

    def log_unauthorized(self, username: Optional[str], endpoint: str):
        """Registra tentativa de acesso não autorizado."""
        self._log(
            level="WARNING",
            event_type="AUTH_UNAUTHORIZED",
            message=f"Acesso negado a {endpoint}",
            user=username,
            details={"endpoint": endpoint},
        )


# Instância global do logger de auditoria
audit_logger = AuditLogger()
