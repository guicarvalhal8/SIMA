"""
Utilitários compartilhados para o módulo de analytics.
"""

import math
from typing import Any


def _round(value: Any, ndigits: int = 4) -> float:
    """
    Arredonda um valor numérico para o número de casas decimais.

    Wrapper tipado que evita erros de type-checking com numpy floats.
    """
    return float(round(float(value), ndigits))


def _safe_float(val: Any) -> float:
    """Converte para float, substituindo NaN/Inf por 0.0."""
    f = float(val)
    return 0.0 if (math.isnan(f) or math.isinf(f)) else f
