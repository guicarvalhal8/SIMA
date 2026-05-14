"""
Análise de correlações entre variáveis acadêmicas.

Calcula correlações de Pearson e Spearman entre
frequência, notas e outros indicadores.
"""

from typing import Dict, Any, List

import numpy as np
from scipy import stats

from app.analytics.utils import _round, _safe_float


class CorrelationAnalyzer:
    """
    Analisador de correlações entre variáveis acadêmicas.

    Suporta:
        - Correlação de Pearson (relação linear)
        - Correlação de Spearman (relação monotônica)
        - Matriz de correlação completa
    """

    @staticmethod
    def pearson(x: List[float], y: List[float]) -> Dict[str, Any]:
        """
        Calcula coeficiente de correlação de Pearson.

        Args:
            x, y: listas de valores numéricos de mesmo tamanho.

        Returns:
            Dicionário com coefficient e p_value.
        """
        if len(x) < 3 or len(x) != len(y):
            return {"coefficient": 0.0, "p_value": 1.0, "interpretation": "Dados insuficientes"}

        coef, p_value = stats.pearsonr(np.array(x), np.array(y))
        coef_f = _safe_float(coef)
        return {
            "coefficient": _round(coef_f),
            "p_value": _round(_safe_float(p_value), 6),
            "interpretation": CorrelationAnalyzer._interpret(coef_f),
        }

    @staticmethod
    def spearman(x: List[float], y: List[float]) -> Dict[str, Any]:
        """
        Calcula coeficiente de correlação de Spearman (ranking).

        Args:
            x, y: listas de valores numéricos de mesmo tamanho.
        """
        if len(x) < 3 or len(x) != len(y):
            return {"coefficient": 0.0, "p_value": 1.0, "interpretation": "Dados insuficientes"}

        coef, p_value = stats.spearmanr(np.array(x), np.array(y))
        coef_f = _safe_float(coef)
        return {
            "coefficient": _round(coef_f),
            "p_value": _round(_safe_float(p_value), 6),
            "interpretation": CorrelationAnalyzer._interpret(coef_f),
        }

    @staticmethod
    def correlation_matrix(data: Dict[str, List[float]]) -> Dict[str, Any]:
        """
        Calcula matriz de correlação para múltiplas variáveis.

        Args:
            data: dicionário {nome_variável: [valores]}

        Returns:
            Dicionário com labels e matrix (2D list).
        """
        labels = list(data.keys())
        if len(labels) < 2:
            return {"labels": labels, "matrix": [], "note": "Mínimo 2 variáveis necessárias"}

        # Alinha tamanhos
        min_len = min(len(v) for v in data.values())
        matrix_data = np.array([data[k][:min_len] for k in labels], dtype=float)

        # Calcula correlação de Pearson entre linhas
        n = len(labels)
        corr_matrix = np.corrcoef(matrix_data)

        return {
            "labels": labels,
            "matrix": [[_round(_safe_float(corr_matrix[i][j])) for j in range(n)] for i in range(n)],
        }

    @staticmethod
    def _interpret(coefficient: float) -> str:
        """Interpreta a magnitude da correlação."""
        abs_coef = abs(coefficient)
        if abs_coef >= 0.8:
            strength = "muito forte"
        elif abs_coef >= 0.6:
            strength = "forte"
        elif abs_coef >= 0.4:
            strength = "moderada"
        elif abs_coef >= 0.2:
            strength = "fraca"
        else:
            strength = "muito fraca ou inexistente"

        direction = "positiva" if coefficient >= 0 else "negativa"
        return f"Correlação {direction} {strength}"
