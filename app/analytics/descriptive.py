"""
Análise estatística descritiva.

Fornece cálculos de média, mediana, desvio padrão, distribuição,
percentis e histogramas para dados acadêmicos.
"""

from typing import List, Dict, Any, Optional
import numpy as np
from scipy import stats

from app.analytics.utils import _round


class DescriptiveAnalyzer:
    """
    Analisador de estatísticas descritivas para dados acadêmicos.

    Aplica métodos estatísticos fundamentais sobre arrays de valores
    numéricos (notas, frequências, etc.), retornando resultados
    em formato dicionário para fácil serialização JSON.
    """

    @staticmethod
    def compute_summary(values: List[float]) -> Dict[str, Any]:
        """
        Calcula resumo estatístico completo de um conjunto de valores.

        Args:
            values: lista de valores numéricos

        Returns:
            Dicionário com mean, median, std, min, max, count, variance,
            skewness, kurtosis e quartis.
        """
        if not values:
            return {"error": "Nenhum dado disponível", "count": 0}

        arr = np.array(values, dtype=float)
        return {
            "count": int(len(arr)),
            "mean": _round(np.mean(arr)),
            "median": _round(np.median(arr)),
            "std": _round(np.std(arr, ddof=1) if len(arr) > 1 else 0.0),
            "variance": _round(np.var(arr, ddof=1) if len(arr) > 1 else 0.0),
            "min": _round(np.min(arr)),
            "max": _round(np.max(arr)),
            "q1": _round(np.percentile(arr, 25)),
            "q2": _round(np.percentile(arr, 50)),
            "q3": _round(np.percentile(arr, 75)),
            "skewness": _round(stats.skew(arr)) if len(arr) > 2 else 0.0,
            "kurtosis": _round(stats.kurtosis(arr)) if len(arr) > 3 else 0.0,
        }

    @staticmethod
    def compute_percentiles(
        values: List[float],
        percentiles: Optional[List[int]] = None,
    ) -> Dict[str, float]:
        """
        Calcula percentis específicos.

        Args:
            values: lista de valores
            percentiles: lista de percentis desejados (default: [10,25,50,75,90])
        """
        if not values:
            return {}
        if percentiles is None:
            percentiles = [10, 25, 50, 75, 90]

        arr = np.array(values, dtype=float)
        return {
            f"p{p}": _round(np.percentile(arr, p))
            for p in percentiles
        }

    @staticmethod
    def compute_histogram(values: List[float], bins: int = 10) -> Dict[str, Any]:
        """
        Gera dados para histograma de distribuição.

        Args:
            values: lista de valores
            bins: número de intervalos

        Returns:
            Dicionário com counts (frequências) e bin_edges (limites).
        """
        if not values:
            return {"counts": [], "bin_edges": []}

        arr = np.array(values, dtype=float)
        counts, bin_edges = np.histogram(arr, bins=bins)
        return {
            "counts": counts.tolist(),
            "bin_edges": [_round(e, 2) for e in bin_edges.tolist()],
        }

    @staticmethod
    def compute_grade_distribution(values: List[float]) -> Dict[str, int]:
        """
        Distribui notas nas faixas padrão brasileiras.

        Faixas: A (9-10), B (7-8.9), C (5-6.9), D (3-4.9), F (0-2.9)
        """
        if not values:
            return {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0}

        arr = np.array(values, dtype=float)
        return {
            "A": int(np.sum((arr >= 9.0) & (arr <= 10.0))),
            "B": int(np.sum((arr >= 7.0) & (arr < 9.0))),
            "C": int(np.sum((arr >= 5.0) & (arr < 7.0))),
            "D": int(np.sum((arr >= 3.0) & (arr < 5.0))),
            "F": int(np.sum(arr < 3.0)),
        }

    @staticmethod
    def compute_pass_rate(values: List[float], threshold: float = 5.0) -> Dict[str, Any]:
        """
        Calcula taxa de aprovação com base em limiar.

        Args:
            values: notas dos alunos
            threshold: nota mínima para aprovação (default 5.0)
        """
        if not values:
            return {"pass_rate": 0.0, "passed": 0, "failed": 0, "total": 0}

        arr = np.array(values, dtype=float)
        passed = int(np.sum(arr >= threshold))
        total = len(arr)
        return {
            "pass_rate": _round(passed / total * 100, 2),
            "passed": passed,
            "failed": total - passed,
            "total": total,
        }
