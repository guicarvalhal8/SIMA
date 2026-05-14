"""
Motor de predição acadêmica.

Implementa modelos para:
    - Predição de risco de evasão (Logistic Regression)
    - Predição de desempenho futuro (Ridge Regression)
"""

from typing import Dict, Any, List
import numpy as np
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score
import warnings

from app.analytics.utils import _round

warnings.filterwarnings("ignore", category=UserWarning)


class DropoutPredictor:
    """
    Preditor de risco de evasão acadêmica.

    Utiliza Regressão Logística para estimar a probabilidade
    de um aluno evadir com base em indicadores acadêmicos.

    Features utilizadas:
        - GPA (média ponderada de notas)
        - Taxa de presença (%)
        - Número de reprovações
        - Número de semestres cursados
        - Tendência de notas (melhora/piora)
    """

    def __init__(self) -> None:
        self.model = LogisticRegression(
            random_state=42,
            max_iter=1000,
            class_weight="balanced",
        )
        self.scaler = StandardScaler()
        self._is_trained = False

    def train(self, features: List[List[float]], labels: List[int]) -> Dict[str, Any]:
        """
        Treina o modelo de predição de evasão.

        Args:
            features: matriz de features [[gpa, attendance_rate, failures, semesters, trend], ...]
            labels: rótulos binários (0=permanece, 1=evadiu)

        Returns:
            Dicionário com métricas de treinamento.
        """
        X = np.array(features, dtype=float)
        y = np.array(labels, dtype=int)

        if len(X) < 10:
            return {"error": "Dados insuficientes (mínimo 10 registros)"}

        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)
        self._is_trained = True

        # Cross-validation
        cv_folds = min(5, len(X) // 2)
        if cv_folds >= 2:
            cv_scores = cross_val_score(self.model, X_scaled, y, cv=cv_folds, scoring="accuracy")
        else:
            cv_scores = np.array([self.model.score(X_scaled, y)])

        return {
            "status": "trained",
            "n_samples": len(X),
            "accuracy_cv_mean": _round(cv_scores.mean()),
            "accuracy_cv_std": _round(cv_scores.std()),
            "feature_names": ["gpa", "attendance_rate", "failures", "semesters", "grade_trend"],
            "coefficients": [_round(c) for c in self.model.coef_[0]],
        }

    def predict(self, features: List[List[float]]) -> List[Dict[str, Any]]:
        """
        Prediz risco de evasão para um ou mais alunos.

        Args:
            features: [[gpa, attendance_rate, failures, semesters, trend], ...]

        Returns:
            Lista de dicionários com risk_score e risk_level.
        """
        if not self._is_trained:
            return [{"error": "Modelo não treinado"}]

        X = np.array(features, dtype=float)
        X_scaled = self.scaler.transform(X)
        probabilities = self.model.predict_proba(X_scaled)

        results: List[Dict[str, Any]] = []
        for prob in probabilities:
            risk_score = float(prob[1]) if len(prob) > 1 else float(prob[0])
            results.append({
                "risk_score": _round(risk_score),
                "risk_level": self._classify_risk(risk_score),
                "stay_probability": _round(1 - risk_score),
            })
        return results

    @staticmethod
    def _classify_risk(score: float) -> str:
        """Classifica o nível de risco com base no score."""
        if score >= 0.75:
            return "critical"
        elif score >= 0.50:
            return "high"
        elif score >= 0.25:
            return "medium"
        return "low"


class PerformancePredictor:
    """
    Preditor de desempenho acadêmico futuro.

    Utiliza Ridge Regression para estimar o GPA
    do próximo semestre com base no histórico.

    Features:
        - GPA atual
        - GPA do semestre anterior
        - Taxa de presença
        - Carga horária (créditos)
        - Número de disciplinas
    """

    def __init__(self) -> None:
        self.model = Ridge(alpha=1.0, random_state=42)
        self.scaler = StandardScaler()
        self._is_trained = False

    def train(self, features: List[List[float]], targets: List[float]) -> Dict[str, Any]:
        """
        Treina o modelo de predição de desempenho.

        Args:
            features: [[gpa_current, gpa_previous, attendance, credits, n_courses], ...]
            targets: GPA real do semestre seguinte

        Returns:
            Métricas de treinamento.
        """
        X = np.array(features, dtype=float)
        y = np.array(targets, dtype=float)

        if len(X) < 5:
            return {"error": "Dados insuficientes (mínimo 5 registros)"}

        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)
        self._is_trained = True

        # R² score
        r2 = self.model.score(X_scaled, y)

        return {
            "status": "trained",
            "n_samples": len(X),
            "r2_score": _round(r2),
            "feature_names": ["gpa_current", "gpa_previous", "attendance_rate", "credits", "n_courses"],
            "coefficients": [_round(c) for c in self.model.coef_],
        }

    def predict(self, features: List[List[float]]) -> List[Dict[str, Any]]:
        """
        Prediz GPA do próximo semestre.

        Returns:
            Lista de dicionários com predicted_gpa e confidence.
        """
        if not self._is_trained:
            return [{"error": "Modelo não treinado"}]

        X = np.array(features, dtype=float)
        X_scaled = self.scaler.transform(X)
        predictions = self.model.predict(X_scaled)

        results: List[Dict[str, Any]] = []
        for pred in predictions:
            clamped = max(0.0, min(10.0, float(pred)))
            results.append({
                "predicted_gpa": _round(clamped, 2),
                "performance_level": self._classify_performance(clamped),
            })
        return results

    @staticmethod
    def _classify_performance(gpa: float) -> str:
        """Classifica nível de desempenho."""
        if gpa >= 8.0:
            return "excellent"
        elif gpa >= 6.0:
            return "good"
        elif gpa >= 4.0:
            return "needs_improvement"
        return "critical"
