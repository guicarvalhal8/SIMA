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


class PartialSemesterPredictor:
    """
    Preditor para planilhas em andamento.
    Estima a nota da VA3, frequência e Média Final baseando-se no desempenho parcial + histórico do aluno.
    """

    def __init__(self) -> None:
        self.model = Ridge(alpha=1.0, random_state=42)
        self.scaler = StandardScaler()
        self._is_trained = False

    def train(self, features: List[List[float]], targets: List[float]) -> Dict[str, Any]:
        """
        Treina o modelo com dados históricos de semestres passados.
        features deve conter: [[va1, va2, gpa_cumulative, failures, is_working, is_night_schedule], ...]
        targets deve conter: [va3_real, ...]
        """
        X = np.array(features, dtype=float)
        y = np.array(targets, dtype=float)

        if len(X) < 5:
            return {"error": "Dados insuficientes para treinamento (mínimo 5)"}

        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)
        self._is_trained = True

        r2 = self.model.score(X_scaled, y)
        return {
            "status": "trained",
            "n_samples": len(X),
            "r2_score": _round(r2),
            "feature_names": ["va1", "va2", "gpa_cumulative", "failures", "is_working", "is_night_schedule"],
            "coefficients": [_round(c) for c in self.model.coef_],
        }

    def predict_va3(
        self,
        va1: float | None,
        va2: float | None,
        gpa_cum: float | None,
        failures: int,
        is_working: bool,
        class_schedule: str | None,
    ) -> float:
        """
        Prediz a nota da VA3 para um aluno em andamento.
        """
        is_night = 1.0 if str(class_schedule or "").upper() in ("NIGHT", "INTEGRAL") else 0.0
        is_working_val = 1.0 if is_working else 0.0
        failures_val = float(failures)

        # Garante valores válidos para notas vazias
        va1_val = float(va1) if va1 is not None else 5.0
        va2_val = float(va2) if va2 is not None else 5.0
        gpa_val = float(gpa_cum) if gpa_cum is not None else (va1_val + va2_val) / 2

        if not self._is_trained:
            # Fallback heurístico inteligente:
            # Ponderação: 70% notas atuais, 30% histórico
            # Penalidades leves para quem trabalha + estuda à noite
            avg_partial = (va1_val + va2_val) / 2

            penalty = 0.0
            if is_working_val > 0:
                penalty += 0.2
            if is_night > 0:
                penalty += 0.1
            if failures_val > 0:
                penalty += min(0.3, failures_val * 0.1)

            predicted = (avg_partial * 0.70) + (gpa_val * 0.30) - penalty
            return _round(max(0.0, min(10.0, predicted)), 1)

        features = [[va1_val, va2_val, gpa_val, failures_val, is_working_val, is_night]]
        X = np.array(features, dtype=float)
        X_scaled = self.scaler.transform(X)
        pred = self.model.predict(X_scaled)[0]
        return _round(max(0.0, min(10.0, float(pred))), 1)

    def predict_missing_grades(
        self,
        grades: dict[str, Any],
        gpa_cum: float | None,
        failures: int,
        is_working: bool,
        class_schedule: str | None,
    ) -> dict[str, float]:
        """
        Estima notas de VA2 e VA3 de forma recursiva baseada no que está preenchido.
        Retorna dicionário de notas com as estimativas de IA injetadas.
        """
        normalized = {str(k).upper().strip(): v for k, v in grades.items()}

        from app.historical.utils import _coerce_grade
        va1_real = _coerce_grade(normalized.get("VA1"))
        va2_real = _coerce_grade(normalized.get("VA2"))
        va3_real = _coerce_grade(normalized.get("VA3"))

        # Determinar VA1 (caso esteja nula, herdamos do GPA ou média)
        va1_val = va1_real if va1_real is not None else (gpa_cum if gpa_cum is not None else 6.0)

        # Se não temos VA2, estimamos com base em VA1
        if va2_real is None:
            gpa_val = gpa_cum if gpa_cum is not None else va1_val
            va2_val = (va1_val * 0.60) + (gpa_val * 0.40)
            if is_working:
                va2_val -= 0.2
            va2_val = _round(max(0.0, min(10.0, va2_val)), 1)
            is_va2_projected = True
        else:
            va2_val = va2_real
            is_va2_projected = False

        # Se não temos VA3, estimamos com base em VA1 e VA2
        if va3_real is None:
            va3_val = self.predict_va3(
                va1=va1_val,
                va2=va2_val,
                gpa_cum=gpa_cum,
                failures=failures,
                is_working=is_working,
                class_schedule=class_schedule
            )
            is_va3_projected = True
        else:
            va3_val = va3_real
            is_va3_projected = False

        result = {}
        for k, v in grades.items():
            if str(k).upper().strip() not in ("VA1", "VA2", "VA3", "VA3 (PROJETADA) ✨", "VA2 (PROJETADA) ✨"):
                result[k] = v

        result["VA1"] = va1_val
        if is_va2_projected:
            result["VA2 (Projetada) ✨"] = va2_val
        else:
            result["VA2"] = va2_val

        if is_va3_projected:
            result["VA3 (Projetada) ✨"] = va3_val
        else:
            result["VA3"] = va3_val

        return result

    def predict_final_attendance(
        self,
        current_attendance: float | None,
        historical_attendance: float | None,
    ) -> float:
        """
        Estima a taxa de presença final do aluno ponderando o desempenho corrente e o histórico.
        """
        curr_val = float(current_attendance) if current_attendance is not None else 100.0
        hist_val = float(historical_attendance) if historical_attendance is not None else curr_val

        # Pondera: 70% presença atual na matéria, 30% comportamento histórico
        projected = (curr_val * 0.70) + (hist_val * 0.30)
        return _round(max(0.0, min(100.0, projected)), 2)

    def predict_final_situation(
        self,
        final_grade: float,
        final_attendance: float,
    ) -> str:
        """
        Determina a situação projetada com base na nota e frequência estimadas.
        """
        if final_grade < 6.0 and final_attendance < 75.0:
            return "Reprovação Provável (Nota e Falta)"
        elif final_grade < 6.0:
            return "Reprovação Provável (Nota)"
        elif final_attendance < 75.0:
            return "Reprovação Provável (Falta)"
        return "Aprovação Provável"

