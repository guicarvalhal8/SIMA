import re
from typing import Optional


EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


def normalize_email(value: str) -> str:
    return str(value or '').strip().lower()


def digits_only(value: Optional[str], max_length: Optional[int] = None) -> Optional[str]:
    if value is None:
        return None
    digits = ''.join(char for char in str(value) if char.isdigit())
    if max_length is not None:
        digits = digits[:max_length]
    return digits


def validate_email_value(value: str) -> str:
    normalized = normalize_email(value)
    if not EMAIL_RE.match(normalized):
        raise ValueError('Informe um e-mail valido.')
    return normalized


def validate_phone_value(value: Optional[str]) -> Optional[str]:
    digits = digits_only(value, 11)
    if not digits:
        return None
    if len(digits) not in {10, 11}:
        raise ValueError('Informe um celular com 10 ou 11 digitos numericos.')
    return digits


def validate_cpf_value(value: str) -> str:
    cpf = digits_only(value, 11) or ''
    if len(cpf) != 11:
        raise ValueError('Informe um CPF com 11 digitos numericos.')
    if cpf == cpf[0] * 11:
        raise ValueError('Informe um CPF valido.')

    total = sum(int(cpf[index]) * (10 - index) for index in range(9))
    check_digit = (total * 10) % 11
    check_digit = 0 if check_digit == 10 else check_digit
    if check_digit != int(cpf[9]):
        raise ValueError('Informe um CPF valido.')

    total = sum(int(cpf[index]) * (11 - index) for index in range(10))
    check_digit = (total * 10) % 11
    check_digit = 0 if check_digit == 10 else check_digit
    if check_digit != int(cpf[10]):
        raise ValueError('Informe um CPF valido.')

    return cpf
