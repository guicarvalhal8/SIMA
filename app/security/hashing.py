"""
Módulo de hashing de senhas.
Utiliza bcrypt diretamente para armazenamento seguro de credenciais.
"""

import bcrypt


def hash_password(plain_password: str) -> str:
    """Gera o hash bcrypt de uma senha em texto plano."""
    password_bytes = plain_password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se uma senha em texto plano corresponde ao hash armazenado."""
    password_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hashed_bytes)
