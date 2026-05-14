"""
Motor de recomendações acadêmicas.

Gera sugestões estratégicas baseadas em dados para
apoio à decisão de coordenadores e gestores acadêmicos.
"""

from typing import List, Dict, Any
from dataclasses import dataclass, asdict
from enum import Enum


class RecommendationType(str, Enum):
    """Tipos de recomendação."""
    TUTORING = "tutoring"
    LOAD_REDUCTION = "load_reduction"
    PRIORITY_ATTENTION = "priority_attention"
    RECOGNITION = "recognition"
    INTERVENTION = "intervention"
    ATTENDANCE_ALERT = "attendance_alert"
    PERFORMANCE_ALERT = "performance_alert"


class Priority(str, Enum):
    """Prioridade da recomendação."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class Recommendation:
    """Estrutura de uma recomendação acadêmica."""
    type: RecommendationType
    priority: Priority
    title: str
    message: str
    target_id: int  # ID do aluno ou curso
    target_name: str
    metrics: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result["type"] = self.type.value
        result["priority"] = self.priority.value
        return result


class AcademicRecommender:
    """
    Motor de recomendações acadêmicas.

    Analisa indicadores de alunos e gera recomendações
    estratégicas hierarquizadas por prioridade.

    Regras implementadas:
        1. GPA < 4.0 → Intervenção urgente
        2. GPA < 6.0 → Tutoria recomendada
        3. Frequência < 60% → Alerta de frequência (crítico)
        4. Frequência < 75% → Alerta de frequência
        5. Reprovações >= 3 → Redução de carga sugerida
        6. Risco evasão >= 0.5 → Atenção prioritária
        7. GPA >= 9.0 → Reconhecimento por destaque
    """

    def __init__(self):
        self.recommendations: List[Recommendation] = []

    def analyze_student(
        self,
        student_id: int,
        student_name: str,
        gpa: float,
        attendance_rate: float,
        failures: int = 0,
        dropout_risk: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        Gera recomendações para um aluno específico.

        Args:
            student_id: ID do aluno
            student_name: nome do aluno
            gpa: média geral (0-10)
            attendance_rate: taxa de presença (0-100)
            failures: número de reprovações
            dropout_risk: score de risco de evasão (0-1)

        Returns:
            Lista de recomendações como dicionários.
        """
        recs = []
        metrics = {
            "gpa": gpa,
            "attendance_rate": attendance_rate,
            "failures": failures,
            "dropout_risk": dropout_risk,
        }

        # ── Regra 1: GPA crítico ──
        if gpa < 4.0:
            recs.append(Recommendation(
                type=RecommendationType.INTERVENTION,
                priority=Priority.CRITICAL,
                title="Intervenção Urgente Necessária",
                message=f"O aluno {student_name} apresenta GPA de {gpa:.1f}, "
                        f"muito abaixo do mínimo. Recomenda-se reunião imediata "
                        f"com coordenação e encaminhamento para suporte pedagógico.",
                target_id=student_id,
                target_name=student_name,
                metrics=metrics,
            ))

        # ── Regra 2: GPA abaixo da média ──
        elif gpa < 6.0:
            recs.append(Recommendation(
                type=RecommendationType.TUTORING,
                priority=Priority.HIGH,
                title="Tutoria Recomendada",
                message=f"O aluno {student_name} apresenta GPA de {gpa:.1f}. "
                        f"Recomenda-se acompanhamento com monitoria e reforço acadêmico.",
                target_id=student_id,
                target_name=student_name,
                metrics=metrics,
            ))

        # ── Regra 3: Frequência crítica ──
        if attendance_rate < 60.0:
            recs.append(Recommendation(
                type=RecommendationType.ATTENDANCE_ALERT,
                priority=Priority.CRITICAL,
                title="Frequência Crítica",
                message=f"O aluno {student_name} possui taxa de presença de "
                        f"{attendance_rate:.1f}%, abaixo do limite de reprovação. "
                        f"Risco iminente de reprovação por falta.",
                target_id=student_id,
                target_name=student_name,
                metrics=metrics,
            ))
        elif attendance_rate < 75.0:
            recs.append(Recommendation(
                type=RecommendationType.ATTENDANCE_ALERT,
                priority=Priority.MEDIUM,
                title="Alerta de Frequência",
                message=f"O aluno {student_name} possui taxa de presença de "
                        f"{attendance_rate:.1f}%. Monitorar para evitar reprovação por falta.",
                target_id=student_id,
                target_name=student_name,
                metrics=metrics,
            ))

        # ── Regra 4: Muitas reprovações ──
        if failures >= 3:
            recs.append(Recommendation(
                type=RecommendationType.LOAD_REDUCTION,
                priority=Priority.HIGH,
                title="Redução de Carga Sugerida",
                message=f"O aluno {student_name} acumula {failures} reprovações. "
                        f"Considere reduzir a carga horária no próximo semestre "
                        f"para melhorar foco e desempenho.",
                target_id=student_id,
                target_name=student_name,
                metrics=metrics,
            ))

        # ── Regra 5: Alto risco de evasão ──
        if dropout_risk >= 0.5:
            recs.append(Recommendation(
                type=RecommendationType.PRIORITY_ATTENTION,
                priority=Priority.CRITICAL if dropout_risk >= 0.75 else Priority.HIGH,
                title="Risco de Evasão Detectado",
                message=f"O aluno {student_name} apresenta risco de evasão de "
                        f"{dropout_risk * 100:.0f}%. Atenção prioritária recomendada.",
                target_id=student_id,
                target_name=student_name,
                metrics=metrics,
            ))

        # ── Regra 6: Destaque acadêmico ──
        if gpa >= 9.0 and attendance_rate >= 90.0:
            recs.append(Recommendation(
                type=RecommendationType.RECOGNITION,
                priority=Priority.LOW,
                title="Destaque Acadêmico",
                message=f"O aluno {student_name} apresenta excelente desempenho "
                        f"(GPA: {gpa:.1f}, Presença: {attendance_rate:.1f}%). "
                        f"Candidato a bolsa ou monitoria.",
                target_id=student_id,
                target_name=student_name,
                metrics=metrics,
            ))

        return [r.to_dict() for r in recs]

    def analyze_batch(
        self, students_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Gera recomendações para um lote de alunos.

        Args:
            students_data: lista de dicts com student_id, student_name,
                          gpa, attendance_rate, failures, dropout_risk.

        Returns:
            Dicionário com total de recomendações, distribuição por
            prioridade e lista completa.
        """
        all_recs = []
        for student in students_data:
            recs = self.analyze_student(**student)
            all_recs.extend(recs)

        # Ordenar por prioridade
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        all_recs.sort(key=lambda r: priority_order.get(r["priority"], 99))

        # Contagem por prioridade
        by_priority = {}
        for r in all_recs:
            by_priority[r["priority"]] = by_priority.get(r["priority"], 0) + 1

        return {
            "total_recommendations": len(all_recs),
            "by_priority": by_priority,
            "recommendations": all_recs,
        }
