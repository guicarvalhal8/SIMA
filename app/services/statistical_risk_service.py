from __future__ import annotations

from collections import defaultdict
from typing import Any
import warnings

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.linear_model import LogisticRegression, LogisticRegressionCV
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.preprocessing import StandardScaler


FACTOR_LABELS = {
    "nota": "Nota",
    "primeira_avaliacao": "Primeira avaliacao",
    "presenca": "Presenca",
    "queda_presenca": "Queda de presenca",
    "atividade": "Atividade",
    "oscilacao": "Oscilacao de notas",
    "aprovacao": "Aprovacao final",
    "historico": "Historico de reprovacoes",
    "carga": "Carga de disciplinas",
    "dificuldade_disciplina": "Dificuldade da disciplina",
    "trabalho": "Trabalho",
}


FEATURE_TO_FACTOR = {
    "grade_risk": "nota",
    "first_assessment_risk": "primeira_avaliacao",
    "attendance_risk": "presenca",
    "attendance_drop_risk": "queda_presenca",
    "activity_risk": "atividade",
    "volatility_risk": "oscilacao",
    "failure_history_risk": "historico",
    "load_risk": "carga",
    "discipline_difficulty_risk": "dificuldade_disciplina",
    "work_balance_risk": "trabalho",
    "performance_pressure": "nota",
    "engagement_gap": "atividade",
    "instability_pressure": "oscilacao",
    "academic_stress": "carga",
    "approval_proxy_risk": "aprovacao",
}


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


class StatisticalRiskService:
    def analyze(self, prepared_records: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        if len(prepared_records) < 12:
            return prepared_records, self._fallback_context("Base insuficiente para modelagem estatistica.")

        frame = self._build_feature_frame(prepared_records)
        if frame.empty:
            return prepared_records, self._fallback_context("Nao foi possivel estruturar a base de features.")

        target = frame["target"].astype(int).to_numpy()
        class_counts = np.bincount(target, minlength=2)
        if class_counts.min() < 2:
            return prepared_records, self._fallback_context("A base atual nao tem variacao suficiente entre risco baixo e alto.")

        feature_columns = [column for column in frame.columns if column not in {"record_id", "target"}]
        processed, minmax_values, preprocessing_summary = self._preprocess_features(frame[feature_columns])
        if processed.empty:
            return prepared_records, self._fallback_context("Nao foi possivel preprocessar as variaveis de risco.")

        folds = max(2, min(5, int(class_counts.min())))
        splitter = StratifiedKFold(n_splits=folds, shuffle=True, random_state=42)

        scaler = StandardScaler()
        scaled = scaler.fit_transform(processed.to_numpy())

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            selector = SelectKBest(score_func=f_classif, k=min(max(8, len(feature_columns) // 2), len(feature_columns)))
            selector.fit(scaled, target)

        selected_mask = selector.get_support()
        if not selected_mask.any():
            selected_mask = np.ones(len(feature_columns), dtype=bool)
        selected_columns = [feature_columns[index] for index, keep in enumerate(selected_mask) if keep]
        scaled_selected = scaled[:, selected_mask]

        anova_scores = selector.scores_ if selector.scores_ is not None else np.zeros(len(feature_columns))
        anova_importance = self._normalize_vector(anova_scores[selected_mask])

        models, diagnostics = self._fit_models(scaled_selected, target, selected_columns, splitter)
        if not models:
            return prepared_records, self._fallback_context("Os modelos estatisticos nao convergiram; mantido fallback heuristico.")

        combined_feature_importance = self._combine_feature_importance(models, anova_importance, selected_columns)
        factor_importance = self._collapse_factor_importance(combined_feature_importance)
        selected_feature_names = [self._feature_label(name) for name in selected_columns]

        selected_norm = processed[selected_columns].copy()
        for column in selected_columns:
            minimum, maximum = minmax_values.get(column, (0.0, 1.0))
            series = selected_norm[column]
            if maximum - minimum <= 1e-9:
                selected_norm[column] = 0.0
            else:
                selected_norm[column] = ((series - minimum) / (maximum - minimum)).clip(0.0, 1.0)

        blended_probabilities = self._blend_probabilities(models, scaled_selected)
        updated_records = self._apply_scores_to_records(
            prepared_records=prepared_records,
            record_ids=frame["record_id"].tolist(),
            probabilities=blended_probabilities,
            selected_norm=selected_norm,
            combined_feature_importance=combined_feature_importance,
            factor_importance=factor_importance,
        )

        context = {
            "mode": "statistical",
            "target_name": "risco_academico_proxy",
            "target_definition": (
                "Proxy supervisionado de risco academico: combina sinais de reprovacao, nota baixa, "
                "presenca baixa, baixa atividade, oscilacao elevada e sobrecarga."
            ),
            "sample_size": int(len(frame)),
            "positive_rate": round(float(target.mean()), 4),
            "folds": folds,
            "selected_features": selected_columns,
            "selected_feature_labels": selected_feature_names,
            "selected_feature_count": len(selected_columns),
            "combined_feature_importance": combined_feature_importance,
            "factor_importance": factor_importance,
            "factor_rows": [
                {
                    "key": key,
                    "label": FACTOR_LABELS.get(key, key),
                    "model_importance_percent": round(value * 100, 2),
                }
                for key, value in sorted(factor_importance.items(), key=lambda item: item[1], reverse=True)
            ],
            "preprocessing": preprocessing_summary,
            "models": diagnostics,
            "techniques_used": [
                "Tratamento de outliers por IQR",
                "Imputacao por mediana",
                "Padronizacao com StandardScaler",
                "Transformacao logaritmica (log1p) em variaveis assimetricas",
                "Criacao de variaveis derivadas de risco academico",
                "Selecao de variaveis com ANOVA",
                "Regressao logistica com regularizacao Ridge e Lasso",
                "Modelos nao lineares com Random Forest e Gradient Boosting",
                "Ensemble ponderado por desempenho",
                f"Validacao cruzada Stratified K-Fold ({folds} folds)",
            ],
        }
        return updated_records, context

    def _fallback_context(self, reason: str) -> dict[str, Any]:
        return {
            "mode": "heuristic_fallback",
            "reason": reason,
            "sample_size": 0,
            "positive_rate": 0.0,
            "folds": 0,
            "selected_features": [],
            "selected_feature_labels": [],
            "selected_feature_count": 0,
            "combined_feature_importance": {},
            "factor_importance": {},
            "factor_rows": [],
            "preprocessing": {
                "missing_values_imputed": 0,
                "outliers_treated": 0,
                "log_transformed_features": [],
                "features_scaled": 0,
            },
            "models": [],
            "techniques_used": [],
        }

    def _build_feature_frame(self, prepared_records: list[dict[str, Any]]) -> pd.DataFrame:
        rows: list[dict[str, Any]] = []
        for record in prepared_records:
            grade_average = _safe_float(record.get("grade_average"))
            first_assessment = _safe_float(record.get("first_assessment"), grade_average)
            attendance = _safe_float(record.get("attendance"))
            activity_score = _safe_float(record.get("activity_score"))
            grade_std = _safe_float(record.get("grade_std"))
            failures = _safe_float(record.get("student_failures"))
            load = _safe_float(record.get("student_load"))
            discipline_difficulty = _safe_float(record.get("discipline_difficulty"))
            work_balance = _safe_float(record.get("work_balance_score"))
            attendance_drop = _safe_float(record.get("attendance_drop"))
            approved = bool(record.get("approved"))
            is_working = bool(record.get("is_working"))
            period = _safe_float(record.get("period"))

            grade_risk = _clamp(1 - (grade_average / 10 if grade_average else 0.0), 0.0, 1.0)
            first_assessment_risk = _clamp(1 - (first_assessment / 10 if first_assessment else 0.0), 0.0, 1.0)
            attendance_risk = _clamp(1 - attendance / 100, 0.0, 1.0)
            activity_risk = _clamp(1 - activity_score / 100, 0.0, 1.0)
            volatility_risk = _clamp(grade_std / 4, 0.0, 1.0)
            failure_history_risk = _clamp(failures / 4, 0.0, 1.0)
            load_risk = _clamp(max(0.0, load - 4) / 5, 0.0, 1.0)
            difficulty_risk = _clamp(discipline_difficulty, 0.0, 1.0)
            work_risk = _clamp(work_balance, 0.0, 1.0) if is_working else 0.0
            approval_proxy_risk = 0.0 if approved else 1.0

            performance_pressure = _clamp((grade_risk * 0.6) + (attendance_risk * 0.4), 0.0, 1.0)
            engagement_gap = _clamp((attendance_risk + activity_risk) / 2, 0.0, 1.0)
            instability_pressure = _clamp((volatility_risk * 0.65) + (difficulty_risk * 0.35), 0.0, 1.0)
            academic_stress = _clamp((load_risk * 0.55) + (work_risk * 0.45), 0.0, 1.0)
            attendance_drop_risk = _clamp(attendance_drop, 0.0, 1.0)

            proxy_points = 0
            proxy_points += 3 if not approved else 0
            proxy_points += 2 if grade_average < 6.0 else 1 if grade_average < 6.8 else 0
            proxy_points += 2 if attendance < 75 else 1 if attendance < 82 else 0
            proxy_points += 1 if activity_score < 55 else 0
            proxy_points += 1 if grade_std > 2.1 else 0
            proxy_points += 1 if failures >= 2 else 0
            proxy_points += 1 if is_working and work_balance > 0.45 else 0
            target = 1 if proxy_points >= 3 else 0

            rows.append({
                "record_id": int(record.get("id")),
                "target": target,
                "grade_risk": grade_risk,
                "first_assessment_risk": first_assessment_risk,
                "attendance_risk": attendance_risk,
                "attendance_drop_risk": attendance_drop_risk,
                "activity_risk": activity_risk,
                "volatility_risk": volatility_risk,
                "failure_history_risk": failure_history_risk,
                "load_risk": load_risk,
                "discipline_difficulty_risk": difficulty_risk,
                "work_balance_risk": work_risk,
                "performance_pressure": performance_pressure,
                "engagement_gap": engagement_gap,
                "instability_pressure": instability_pressure,
                "academic_stress": academic_stress,
                "approval_proxy_risk": approval_proxy_risk,
                "period": period,
            })
        return pd.DataFrame(rows)

    def _preprocess_features(self, frame: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, tuple[float, float]], dict[str, Any]]:
        processed = frame.copy()
        minmax_values: dict[str, tuple[float, float]] = {}
        total_missing = 0
        total_outliers = 0
        log_features: list[str] = []

        for column in processed.columns:
            series = pd.to_numeric(processed[column], errors="coerce")
            total_missing += int(series.isna().sum())

            median = float(series.median()) if not series.dropna().empty else 0.0
            series = series.fillna(median)

            q1 = float(series.quantile(0.25))
            q3 = float(series.quantile(0.75))
            iqr = q3 - q1
            lower = q1 - (1.5 * iqr) if iqr > 0 else float(series.min())
            upper = q3 + (1.5 * iqr) if iqr > 0 else float(series.max())
            total_outliers += int(((series < lower) | (series > upper)).sum())
            series = series.clip(lower, upper)

            skewness = float(series.skew()) if len(series) > 2 else 0.0
            if series.min() >= 0 and abs(skewness) > 1.0:
                series = np.log1p(series)
                log_features.append(column)

            processed[column] = series.astype(float)
            minmax_values[column] = (float(series.min()), float(series.max()))

        summary = {
            "missing_values_imputed": total_missing,
            "outliers_treated": total_outliers,
            "log_transformed_features": [self._feature_label(name) for name in log_features],
            "features_scaled": len(processed.columns),
        }
        return processed, minmax_values, summary

    def _fit_models(
        self,
        scaled_selected: np.ndarray,
        target: np.ndarray,
        selected_columns: list[str],
        splitter: StratifiedKFold,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        lasso_cv = LogisticRegressionCV(
            Cs=6,
            cv=splitter,
            penalty="l1",
            solver="liblinear",
            scoring="roc_auc",
            class_weight="balanced",
            max_iter=4000,
            random_state=42,
        )
        ridge_cv = LogisticRegressionCV(
            Cs=6,
            cv=splitter,
            penalty="l2",
            solver="lbfgs",
            scoring="roc_auc",
            class_weight="balanced",
            max_iter=4000,
            random_state=42,
        )

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            lasso_cv.fit(scaled_selected, target)
            ridge_cv.fit(scaled_selected, target)

        estimators = [
            {
                "id": "lasso_logit",
                "label": "Regressao logistica Lasso",
                "estimator": LogisticRegression(
                    penalty="l1",
                    solver="liblinear",
                    C=float(np.atleast_1d(lasso_cv.C_)[0]),
                    class_weight="balanced",
                    max_iter=4000,
                    random_state=42,
                ),
            },
            {
                "id": "ridge_logit",
                "label": "Regressao logistica Ridge",
                "estimator": LogisticRegression(
                    penalty="l2",
                    solver="lbfgs",
                    C=float(np.atleast_1d(ridge_cv.C_)[0]),
                    class_weight="balanced",
                    max_iter=4000,
                    random_state=42,
                ),
            },
            {
                "id": "random_forest",
                "label": "Random Forest",
                "estimator": RandomForestClassifier(
                    n_estimators=140,
                    max_depth=6,
                    min_samples_leaf=2,
                    class_weight="balanced",
                    random_state=42,
                ),
            },
            {
                "id": "gradient_boosting",
                "label": "Gradient Boosting",
                "estimator": GradientBoostingClassifier(random_state=42),
            },
        ]

        successful_models: list[dict[str, Any]] = []
        diagnostics: list[dict[str, Any]] = []

        for candidate in estimators:
            estimator = candidate["estimator"]
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    cv_probabilities = cross_val_predict(
                        estimator,
                        scaled_selected,
                        target,
                        cv=splitter,
                        method="predict_proba",
                    )[:, 1]
                    estimator.fit(scaled_selected, target)
                predictions = (cv_probabilities >= 0.5).astype(int)
                roc_auc = float(roc_auc_score(target, cv_probabilities))
                f1 = float(f1_score(target, predictions, zero_division=0))
                accuracy = float(accuracy_score(target, predictions))
            except Exception:
                continue

            importance = self._extract_importance(estimator, selected_columns)
            weight = max(0.05, roc_auc - 0.5)
            successful_models.append({
                "id": candidate["id"],
                "label": candidate["label"],
                "estimator": estimator,
                "weight": weight,
                "importance": importance,
            })
            diagnostics.append({
                "id": candidate["id"],
                "label": candidate["label"],
                "roc_auc": round(roc_auc, 4),
                "f1": round(f1, 4),
                "accuracy": round(accuracy, 4),
                "ensemble_weight": round(weight, 4),
                "type": "nao linear" if candidate["id"] in {"random_forest", "gradient_boosting"} else "linear regularizado",
            })

        return successful_models, diagnostics

    def _extract_importance(self, estimator: Any, selected_columns: list[str]) -> dict[str, float]:
        raw_values: np.ndarray
        if hasattr(estimator, "coef_"):
            raw_values = np.abs(np.ravel(estimator.coef_))
        elif hasattr(estimator, "feature_importances_"):
            raw_values = np.abs(np.ravel(estimator.feature_importances_))
        else:
            raw_values = np.ones(len(selected_columns), dtype=float)
        normalized = self._normalize_vector(raw_values)
        return {selected_columns[index]: float(normalized[index]) for index in range(len(selected_columns))}

    def _combine_feature_importance(
        self,
        models: list[dict[str, Any]],
        anova_importance: np.ndarray,
        selected_columns: list[str],
    ) -> dict[str, float]:
        combined = defaultdict(float)
        total_weight = 0.0
        for model in models:
            model_weight = float(model["weight"])
            total_weight += model_weight
            for feature, value in model["importance"].items():
                combined[feature] += value * model_weight

        if total_weight > 0:
            for feature in list(combined.keys()):
                combined[feature] = combined[feature] / total_weight

        if len(anova_importance):
            for index, feature in enumerate(selected_columns):
                combined[feature] = (combined.get(feature, 0.0) * 0.75) + (float(anova_importance[index]) * 0.25)

        normalized = self._normalize_mapping(combined)
        return normalized

    def _collapse_factor_importance(self, feature_importance: dict[str, float]) -> dict[str, float]:
        factor_importance = defaultdict(float)
        for feature, value in feature_importance.items():
            factor_importance[FEATURE_TO_FACTOR.get(feature, feature)] += float(value)
        return self._normalize_mapping(factor_importance)

    def _blend_probabilities(self, models: list[dict[str, Any]], scaled_selected: np.ndarray) -> np.ndarray:
        weighted_sum = np.zeros(scaled_selected.shape[0], dtype=float)
        total_weight = 0.0
        for model in models:
            probabilities = model["estimator"].predict_proba(scaled_selected)[:, 1]
            weighted_sum += probabilities * float(model["weight"])
            total_weight += float(model["weight"])
        if total_weight <= 0:
            return np.clip(weighted_sum, 0.0, 1.0)
        return np.clip(weighted_sum / total_weight, 0.0, 1.0)

    def _apply_scores_to_records(
        self,
        prepared_records: list[dict[str, Any]],
        record_ids: list[int],
        probabilities: np.ndarray,
        selected_norm: pd.DataFrame,
        combined_feature_importance: dict[str, float],
        factor_importance: dict[str, float],
    ) -> list[dict[str, Any]]:
        rows_by_id = {int(record["id"]): record for record in prepared_records if record.get("id") is not None}

        for index, record_id in enumerate(record_ids):
            row = rows_by_id.get(int(record_id))
            if row is None:
                continue

            risk_score = round(float(probabilities[index]), 4)
            local_feature_weights = defaultdict(float)
            for feature, importance in combined_feature_importance.items():
                local_value = float(selected_norm.iloc[index][feature]) if feature in selected_norm.columns else 0.0
                local_feature_weights[feature] += local_value * float(importance)

            factor_breakdown = defaultdict(float)
            total_local_weight = sum(local_feature_weights.values())
            if total_local_weight <= 1e-9:
                for factor, importance in factor_importance.items():
                    factor_breakdown[factor] = round(float(importance) * risk_score, 4)
            else:
                for feature, value in local_feature_weights.items():
                    factor = FEATURE_TO_FACTOR.get(feature, feature)
                    factor_breakdown[factor] += (value / total_local_weight) * risk_score

            for factor_key in FACTOR_LABELS:
                factor_breakdown.setdefault(factor_key, 0.0)

            normalized_breakdown = {
                key: round(_clamp(float(value), 0.0, risk_score), 4)
                for key, value in factor_breakdown.items()
            }
            drivers = [
                key
                for key, value in sorted(normalized_breakdown.items(), key=lambda item: item[1], reverse=True)
                if value > 0.0001
            ][:4]

            row.update({
                "risk_score": risk_score,
                "risk_level": self._classify_risk(risk_score),
                "risk_breakdown": normalized_breakdown,
                "risk_drivers": drivers,
                "risk_method": "statistical_pipeline",
                "model_probability": risk_score,
            })
        return prepared_records

    def _normalize_vector(self, values: np.ndarray) -> np.ndarray:
        clean = np.nan_to_num(np.asarray(values, dtype=float), nan=0.0, posinf=0.0, neginf=0.0)
        clean = np.clip(clean, 0.0, None)
        total = float(clean.sum())
        if total <= 1e-9:
            if len(clean) == 0:
                return clean
            return np.full_like(clean, 1 / len(clean), dtype=float)
        return clean / total

    def _normalize_mapping(self, mapping: dict[str, float] | defaultdict[str, float]) -> dict[str, float]:
        total = float(sum(max(0.0, float(value)) for value in mapping.values()))
        if total <= 1e-9:
            return {key: 0.0 for key in mapping}
        return {key: float(max(0.0, value) / total) for key, value in mapping.items()}

    def _feature_label(self, feature_name: str) -> str:
        labels = {
            "grade_risk": "Risco por nota",
            "first_assessment_risk": "Risco na primeira avaliacao",
            "attendance_risk": "Risco por presenca",
            "attendance_drop_risk": "Queda de presenca",
            "activity_risk": "Risco por atividade",
            "volatility_risk": "Oscilacao de notas",
            "failure_history_risk": "Historico de reprovacoes",
            "load_risk": "Sobrecarga de disciplinas",
            "discipline_difficulty_risk": "Dificuldade da disciplina",
            "work_balance_risk": "Impacto do trabalho",
            "performance_pressure": "Pressao de desempenho",
            "engagement_gap": "Gap de engajamento",
            "instability_pressure": "Instabilidade academica",
            "academic_stress": "Estresse academico",
            "approval_proxy_risk": "Sinal de aprovacao",
            "period": "Periodo do curso",
        }
        return labels.get(feature_name, feature_name)

    def _classify_risk(self, risk_score: float) -> str:
        if risk_score >= 0.75:
            return "critical"
        if risk_score >= 0.58:
            return "high"
        if risk_score >= 0.38:
            return "medium"
        return "low"
