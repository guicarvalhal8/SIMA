"""Schemas Pydantic para respostas analíticas."""

from pydantic import BaseModel
from typing import Any, Dict, List, Optional


class OverviewKPI(BaseModel):
    total_students: int
    active_students: int
    total_courses: int
    average_gpa: float
    average_attendance_rate: float
    at_risk_count: int
    pass_rate: float


class StudentRisk(BaseModel):
    student_id: int
    student_name: str
    registration_number: str
    gpa: float
    attendance_rate: float
    risk_score: float
    risk_level: str


class AnalyticsOverview(BaseModel):
    kpis: OverviewKPI
    grade_distribution: Dict[str, int]
    risk_summary: Dict[str, int]
    top_at_risk: List[StudentRisk]


class PredictionResult(BaseModel):
    student_id: int
    student_name: str
    risk_score: float
    risk_level: str
    predicted_gpa: Optional[float] = None
    recommendations: List[Dict[str, Any]] = []


class CorrelationResult(BaseModel):
    labels: List[str]
    matrix: List[List[float]]


class PCAResult(BaseModel):
    n_components: int
    explained_variance_ratio: List[float]
    cumulative_variance: List[float]
    feature_importance: List[Dict[str, Any]]
    transformed_data: List[List[float]]


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, Any]]] = None
    file_content: Optional[str] = None
