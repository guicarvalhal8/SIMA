"""
Módulo de álgebra linear aplicada.

Implementa PCA (Análise de Componentes Principais), normalização
de matrizes e decomposição para redução de dimensionalidade
de dados acadêmicos.
"""

from typing import Dict, Any, List, Optional
import numpy as np

from app.analytics.utils import _round


class LinearAlgebraEngine:
    """
    Engine de álgebra linear para tratamento de dados acadêmicos.

    Aplica:
        - Normalização (z-score) de matrizes de dados
        - Cálculo de matriz de covariância
        - PCA via decomposição de autovalores/autovetores
        - Redução de dimensionalidade para identificar fatores mais influentes
    """

    @staticmethod
    def normalize(matrix: List[List[float]]) -> Dict[str, Any]:
        """
        Normaliza uma matriz de dados usando z-score (média=0, std=1).

        Args:
            matrix: dados como lista de listas [[feature_1, feature_2, ...], ...]

        Returns:
            Dicionário com normalized_matrix, means e stds.
        """
        arr = np.array(matrix, dtype=float)
        means = np.mean(arr, axis=0)
        stds = np.std(arr, axis=0, ddof=1)
        # Evita divisão por zero
        stds[stds == 0] = 1.0
        normalized = (arr - means) / stds

        return {
            "normalized_matrix": normalized.tolist(),
            "means": [_round(m) for m in means],
            "stds": [_round(s) for s in stds],
        }

    @staticmethod
    def covariance_matrix(matrix: List[List[float]]) -> Dict[str, Any]:
        """
        Calcula a matriz de covariância dos dados.

        Args:
            matrix: dados normalizados (ou brutos) como lista de listas

        Returns:
            Dicionário com a cov_matrix.
        """
        arr = np.array(matrix, dtype=float)
        cov = np.cov(arr, rowvar=False)
        return {
            "cov_matrix": [[_round(cov[i][j])
                            for j in range(cov.shape[1])]
                           for i in range(cov.shape[0])],
        }

    @staticmethod
    def pca(
        matrix: List[List[float]],
        feature_names: Optional[List[str]] = None,
        n_components: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Executa Análise de Componentes Principais (PCA).

        Implementação manual usando decomposição de autovalores
        para fins didáticos, demonstrando fundamentos de álgebra linear.

        Args:
            matrix: dados como [[f1, f2, ...], ...] — cada linha é uma observação
            feature_names: nomes das features (opcional)
            n_components: número de componentes a reter (default: todos)

        Returns:
            Dicionário com eigenvalues, eigenvectors, explained_variance,
            cumulative_variance, transformed_data e feature_importance.
        """
        arr = np.array(matrix, dtype=float)
        n_samples, n_features = arr.shape

        if feature_names is None:
            feature_names = [f"feature_{i}" for i in range(n_features)]

        # 1. Centralizar dados (média zero)
        means = np.mean(arr, axis=0)
        centered = arr - means

        # 2. Matriz de covariância
        cov_matrix = np.cov(centered, rowvar=False)

        # 3. Decomposição em autovalores e autovetores
        eigenvalues, eigenvectors = np.linalg.eigh(cov_matrix)

        # 4. Ordenar por autovalor decrescente
        sorted_idx = np.argsort(eigenvalues)[::-1]
        eigenvalues = eigenvalues[sorted_idx]
        eigenvectors = eigenvectors[:, sorted_idx]

        # 5. Variância explicada
        total_variance = float(np.sum(eigenvalues))
        explained_variance = eigenvalues / total_variance if total_variance > 0 else eigenvalues
        cumulative_variance = np.cumsum(explained_variance)

        # 6. Selecionar componentes
        actual_components = n_features if n_components is None else n_components
        actual_components = min(actual_components, n_features)

        # 7. Transformar dados (projeção nos componentes principais)
        projection_matrix = eigenvectors[:, :actual_components]
        transformed = centered @ projection_matrix

        # 8. Importância de cada feature (magnitude dos loadings)
        feature_importance: List[Dict[str, Any]] = []
        for i, name in enumerate(feature_names):
            importance = float(np.sum(np.abs(eigenvectors[i, :actual_components]) * explained_variance[:actual_components]))
            feature_importance.append({
                "feature": name,
                "importance": _round(importance),
            })
        feature_importance.sort(key=lambda x: x["importance"], reverse=True)

        return {
            "n_components": actual_components,
            "eigenvalues": [_round(ev) for ev in eigenvalues[:actual_components]],
            "explained_variance_ratio": [_round(ev) for ev in explained_variance[:actual_components]],
            "cumulative_variance": [_round(cv) for cv in cumulative_variance[:actual_components]],
            "feature_importance": feature_importance,
            "transformed_data": [[_round(v) for v in row] for row in transformed.tolist()],
            "components": [[_round(v) for v in eigenvectors[:, i]]
                           for i in range(actual_components)],
        }

    @staticmethod
    def matrix_rank(matrix: List[List[float]]) -> int:
        """Calcula o posto (rank) de uma matriz."""
        return int(np.linalg.matrix_rank(np.array(matrix, dtype=float)))

    @staticmethod
    def determinant(matrix: List[List[float]]) -> float:
        """Calcula o determinante de uma matriz quadrada."""
        return _round(np.linalg.det(np.array(matrix, dtype=float)))
