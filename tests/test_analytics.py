"""Testes dos motores de análise estatística, álgebra linear e predição."""

import pytest
from app.analytics.descriptive import DescriptiveAnalyzer
from app.analytics.correlations import CorrelationAnalyzer
from app.analytics.linear_algebra import LinearAlgebraEngine
from app.analytics.predictor import DropoutPredictor, PerformancePredictor
from app.analytics.recommender import AcademicRecommender


class TestDescriptiveAnalyzer:
    def test_compute_summary(self):
        vals = [5.0, 7.0, 8.0, 6.0, 9.0, 4.0, 3.0, 7.5, 8.5, 6.5]
        result = DescriptiveAnalyzer.compute_summary(vals)
        assert result["count"] == 10
        assert 5.0 <= result["mean"] <= 7.5
        assert result["min"] == 3.0
        assert result["max"] == 9.0
        assert "std" in result
        assert "q1" in result
        assert "q3" in result

    def test_empty_values(self):
        result = DescriptiveAnalyzer.compute_summary([])
        assert result["count"] == 0

    def test_grade_distribution(self):
        vals = [9.5, 7.5, 5.5, 3.5, 1.5, 10.0, 8.0, 6.0, 4.0, 2.0]
        dist = DescriptiveAnalyzer.compute_grade_distribution(vals)
        assert dist["A"] == 2  # 9.5, 10.0
        assert dist["B"] == 2  # 7.5, 8.0
        assert dist["C"] == 2  # 5.5, 6.0
        assert dist["D"] == 2  # 3.5, 4.0
        assert dist["F"] == 2  # 1.5, 2.0

    def test_pass_rate(self):
        vals = [3.0, 5.0, 7.0, 9.0]
        result = DescriptiveAnalyzer.compute_pass_rate(vals, threshold=5.0)
        assert result["passed"] == 3
        assert result["failed"] == 1
        assert result["pass_rate"] == 75.0

    def test_histogram(self):
        vals = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]
        result = DescriptiveAnalyzer.compute_histogram(vals, bins=5)
        assert len(result["counts"]) == 5
        assert len(result["bin_edges"]) == 6


class TestCorrelationAnalyzer:
    def test_pearson_positive(self):
        x = [1, 2, 3, 4, 5, 6, 7, 8]
        y = [2, 4, 6, 8, 10, 12, 14, 16]
        result = CorrelationAnalyzer.pearson(x, y)
        assert result["coefficient"] > 0.99
        assert "positiva" in result["interpretation"]

    def test_correlation_matrix(self):
        data = {"A": [1, 2, 3, 4, 5], "B": [5, 4, 3, 2, 1], "C": [2, 4, 6, 8, 10]}
        result = CorrelationAnalyzer.correlation_matrix(data)
        assert len(result["labels"]) == 3
        assert len(result["matrix"]) == 3


class TestLinearAlgebraEngine:
    def test_normalize(self):
        m = [[1, 2], [3, 4], [5, 6]]
        result = LinearAlgebraEngine.normalize(m)
        assert len(result["normalized_matrix"]) == 3
        assert len(result["means"]) == 2

    def test_pca(self):
        m = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12],
             [2, 3, 4], [5, 6, 7], [8, 9, 10], [3, 4, 5]]
        result = LinearAlgebraEngine.pca(m, n_components=2)
        assert result["n_components"] == 2
        assert len(result["eigenvalues"]) == 2
        assert len(result["explained_variance_ratio"]) == 2
        assert len(result["feature_importance"]) == 3

    def test_matrix_rank(self):
        m = [[1, 0], [0, 1]]
        assert LinearAlgebraEngine.matrix_rank(m) == 2


class TestDropoutPredictor:
    def test_train_and_predict(self):
        features = [
            [8.5, 95.0, 0, 4, 0.5],
            [7.0, 85.0, 1, 3, 0.2],
            [3.0, 55.0, 3, 5, -1.0],
            [2.5, 40.0, 4, 6, -2.0],
            [9.0, 98.0, 0, 3, 1.0],
            [6.5, 78.0, 1, 4, 0.1],
            [4.0, 60.0, 2, 5, -0.5],
            [1.5, 30.0, 5, 7, -3.0],
            [7.5, 90.0, 0, 2, 0.8],
            [5.5, 70.0, 2, 4, -0.2],
            [8.0, 92.0, 0, 3, 0.6],
            [3.5, 50.0, 3, 6, -1.5],
        ]
        labels = [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 1]

        predictor = DropoutPredictor()
        result = predictor.train(features, labels)
        assert result["status"] == "trained"

        preds = predictor.predict([[8.0, 90.0, 0, 3, 0.5]])
        assert len(preds) == 1
        assert "risk_score" in preds[0]
        assert preds[0]["risk_level"] in ("low", "medium", "high", "critical")


class TestRecommender:
    def test_critical_gpa(self):
        rec = AcademicRecommender()
        recs = rec.analyze_student(1, "Test", gpa=2.5, attendance_rate=80.0)
        types = [r["type"] for r in recs]
        assert "intervention" in types

    def test_attendance_alert(self):
        rec = AcademicRecommender()
        recs = rec.analyze_student(1, "Test", gpa=7.0, attendance_rate=55.0)
        types = [r["type"] for r in recs]
        assert "attendance_alert" in types

    def test_recognition(self):
        rec = AcademicRecommender()
        recs = rec.analyze_student(1, "Test", gpa=9.5, attendance_rate=95.0)
        types = [r["type"] for r in recs]
        assert "recognition" in types
