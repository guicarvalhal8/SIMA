"""
Serviço de analytics — orquestra as engines de análise
e prepara os dados para os endpoints da API.
"""

from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.student import Student, StudentStatus
from app.models.course import Course
from app.models.grade import Grade
from app.models.attendance import Attendance, AttendanceStatus
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.scraped_data import ScrapedGrade, ScrapedAttendance, ScrapedSubject, ScrapedSchedule
from app.analytics.descriptive import DescriptiveAnalyzer
from app.analytics.correlations import CorrelationAnalyzer
from app.analytics.linear_algebra import LinearAlgebraEngine
from app.analytics.predictor import DropoutPredictor, PerformancePredictor
from app.analytics.recommender import AcademicRecommender
from app.analytics.utils import _round


class AnalyticsService:
    """
    Serviço centralizado de análises acadêmicas.

    Orquestra:
        - Cálculo de KPIs e indicadores
        - Estatísticas descritivas
        - Correlações entre variáveis
        - PCA para redução de dimensionalidade
        - Predição de evasão e desempenho
        - Geração de recomendações
    """

    def __init__(self, db: Session):
        self.db = db
        self.stats = DescriptiveAnalyzer()
        self.correlations = CorrelationAnalyzer()
        self.linalg = LinearAlgebraEngine()
        self.dropout_predictor = DropoutPredictor()
        self.performance_predictor = PerformancePredictor()
        self.recommender = AcademicRecommender()

    # ─── Métodos auxiliares ───

    def _get_student_gpa(self, student_id: int) -> float:
        """Calcula GPA ponderado de um aluno."""
        grades = self.db.query(Grade).filter(Grade.student_id == student_id).all()
        if not grades:
            return 0.0
        total_weight = sum(g.weight for g in grades)
        if total_weight == 0:
            return 0.0
        weighted_sum = sum(g.value * g.weight for g in grades)
        return _round(weighted_sum / total_weight, 2)

    def _get_student_attendance_rate(self, student_id: int) -> float:
        """Calcula taxa de presença (%) de um aluno."""
        attendances = self.db.query(Attendance).filter(
            Attendance.student_id == student_id
        ).all()
        if not attendances:
            return 100.0
        present = sum(
            1 for a in attendances
            if a.status in (AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.JUSTIFIED)
        )
        return _round(present / len(attendances) * 100, 2)

    def _get_student_failures(self, student_id: int) -> int:
        """Conta reprovações de um aluno."""
        return self.db.query(Enrollment).filter(
            Enrollment.student_id == student_id,
            Enrollment.status == EnrollmentStatus.FAILED,
        ).count()

    def _get_student_semesters(self, student_id: int) -> int:
        """Conta semestres distintos de um aluno."""
        result = self.db.query(
            func.count(func.distinct(Enrollment.semester))
        ).filter(Enrollment.student_id == student_id).scalar()
        return result or 1

    def _get_grade_trend(self, student_id: int) -> float:
        """
        Calcula tendência de notas (positiva = melhora, negativa = piora).
        Usa diferença entre média recente e média geral.
        """
        # Tentar primeiro scraped_grades
        grades = self.db.query(ScrapedGrade).filter(
            ScrapedGrade.student_id == student_id
        ).all()
        
        # Fallback para Grade regular se não houver scraped
        if not grades:
            grades = self.db.query(Grade).filter(
                Grade.student_id == student_id
            ).order_by(Grade.id).all()

        if len(grades) < 2:
            return 0.0

        all_values: List[float] = [getattr(g, 'media', getattr(g, 'value', 0.0)) for g in grades]
        half = len(all_values) // 2
        first_half_avg = sum(all_values[:half]) / half
        second_half_avg = sum(all_values[half:]) / (len(all_values) - half)
        return _round(second_half_avg - first_half_avg, 2)

    # ─── Métodos para Dados Scraped (Lyceum) ───

    def _get_scraped_gpa(self, student_id: int) -> float:
        """Calcula GPA a partir de notas sincronizadas do Lyceum."""
        grades = self.db.query(ScrapedGrade).filter(ScrapedGrade.student_id == student_id).all()
        if not grades:
            return 0.0
        
        valid_grades = [g.media for g in grades if g.media > 0]
        if not valid_grades:
            return 0.0
            
        return _round(sum(valid_grades) / len(valid_grades), 2)

    def _is_beginning_of_semester(self, student_id: int) -> bool:
        """
        Verifica se o aluno está no início do período (sem notas lançadas).
        Retorna True se existem disciplinas mas nenhuma tem nota > 0.
        """
        scraped_grades = self.db.query(ScrapedGrade).filter(
            ScrapedGrade.student_id == student_id
        ).all()
        
        # Se tem disciplinas scraped mas nenhuma nota válida
        if scraped_grades:
            has_any_grade = any(g.media > 0 for g in scraped_grades)
            if not has_any_grade:
                return True
        
        # Se tem disciplinas (subjects) mas sem grades
        has_subjects = self.db.query(ScrapedSubject).filter(
            ScrapedSubject.student_id == student_id
        ).count() > 0
        
        has_grades = self.db.query(ScrapedGrade).filter(
            ScrapedGrade.student_id == student_id
        ).count() > 0
        
        if has_subjects and not has_grades:
            return True
        
        return False

    def _get_scraped_attendance_rate(self, student_id: int) -> float:
        """Calcula taxa de presença média das disciplinas sincronizadas."""
        attendances = self.db.query(ScrapedAttendance).filter(
            ScrapedAttendance.student_id == student_id
        ).all()
        if not attendances:
            return 100.0
        
        rates = [a.percentual_presenca for a in attendances]
        return _round(sum(rates) / len(rates), 2)

    def _get_scraped_failures(self, student_id: int) -> int:
        """Conta disciplinas com situação de reprovação no Lyceum."""
        # Consideramos 'Reprovado' ou situações similares
        return self.db.query(ScrapedGrade).filter(
            ScrapedGrade.student_id == student_id,
            ScrapedGrade.situacao.ilike("%Reprovado%")
        ).count()

    def get_student_overview(self, student_id: int) -> Dict[str, Any]:
        """Gera dashboard completo para um único aluno."""
        student = self.db.query(Student).filter(Student.id == student_id).first()
        if not student:
            return {"error": "Aluno não encontrado"}

        # Verificar se está no início do período (sem notas)
        beginning_of_semester = self._is_beginning_of_semester(student_id)

        # Priorizar dados scraped (Lyceum) se existirem
        has_scraped = self.db.query(ScrapedGrade).filter(ScrapedGrade.student_id == student_id).count() > 0
        
        if has_scraped:
            gpa = self._get_scraped_gpa(student_id)
            att = self._get_scraped_attendance_rate(student_id)
            failures = self._get_scraped_failures(student_id)
        else:
            gpa = self._get_student_gpa(student_id)
            att = self._get_student_attendance_rate(student_id)
            failures = self._get_student_failures(student_id)

        semesters = self._get_student_semesters(student_id)
        trend = self._get_grade_trend(student_id)

        # Se início de período, não calcular risco com GPA 0
        if beginning_of_semester:
            risk_score = 0.0
            risk_level = "low"
            recommendations = []  # Sem recomendações alarmantes
        else:
            # Risco e Predições (heurístico ou via predictor se houver dados suficientes)
            risk_score = max(0.0, min(1.0, (1 - gpa / 10) * 0.6 + (1 - att / 100) * 0.4))
            risk_level = self._classify_risk(risk_score)

            # Recomendações
            recommendations = self.recommender.analyze_student(
                student_id=student_id,
                student_name=student.name,
                gpa=gpa,
                attendance_rate=att,
                failures=failures,
                dropout_risk=risk_score
            )

        # Histórico de notas (tendência temporal)
        scraped_grades = self.db.query(ScrapedGrade).filter(ScrapedGrade.student_id == student_id).all()
        history = [
            {"disciplina": g.disciplina, "media": g.media, "situacao": g.situacao}
            for g in scraped_grades
        ]

        return {
            "student_info": {
                "id": student_id,
                "name": student.name,
                "registration": student.registration_number,
                "course": student.course_name,
            },
            "kpis": {
                "gpa": gpa,
                "attendance_rate": att,
                "failures": failures,
                "risk_score": _round(risk_score, 4),
                "risk_level": risk_level,
                "grade_trend": trend,
                "beginning_of_semester": beginning_of_semester,
            },
            "history": history,
            "recommendations": recommendations,
        }

    # ─── KPIs ───

    def get_overview(self, course_ids: List[int] = None, student_ids: List[int] = None) -> Dict[str, Any]:
        """Gera overview completo com KPIs e distribuições, opcionalmente filtrado por disciplinas ou IDs de alunos."""
        if student_ids is not None and not student_ids:
            return {
                "kpis": {
                    "total_students": 0, "active_students": 0, "total_courses": 0,
                    "average_gpa": 0.0, "average_attendance_rate": 0.0,
                    "at_risk_count": 0, "pass_rate": 0.0
                },
                "grade_distribution": {}, "risk_summary": {"low": 0, "medium": 0, "high": 0, "critical": 0},
                "top_at_risk": []
            }
        if course_ids is not None and not course_ids and student_ids is None:
            return {
                "kpis": {
                    "total_students": 0, "active_students": 0, "total_courses": 0,
                    "average_gpa": 0.0, "average_attendance_rate": 0.0,
                    "at_risk_count": 0, "pass_rate": 0.0
                },
                "grade_distribution": {}, "risk_summary": {"low": 0, "medium": 0, "high": 0, "critical": 0},
                "top_at_risk": []
            }

        student_query = self.db.query(Student).filter(Student.status == StudentStatus.ACTIVE)
        grade_query = self.db.query(Grade)
        course_query = self.db.query(Course)

        if student_ids is not None:
            student_query = student_query.filter(Student.id.in_(student_ids))
            # Também filtrar courses se course_ids foi passado junto
            if course_ids is not None:
                grade_query = grade_query.filter(Grade.course_id.in_(course_ids))
                course_query = course_query.filter(Course.id.in_(course_ids))
        elif course_ids is not None:
            # Se filtrado por disciplinas, buscamos apenas alunos matriculados nelas
            enrollment_sids = (
                self.db.query(Enrollment.student_id)
                .filter(Enrollment.course_id.in_(course_ids))
                .distinct()
                .all()
            )
            enrollment_sids = [sid[0] for sid in enrollment_sids]
            student_query = student_query.filter(Student.id.in_(enrollment_sids))
            grade_query = grade_query.filter(Grade.course_id.in_(course_ids))
            course_query = course_query.filter(Course.id.in_(course_ids))

        total_students = student_query.count()
        active_students = total_students # student_query já filtra por ACTIVE
        total_courses = course_query.count()

        # Calcular GPAs de todos os alunos filtrados
        active_students_list = student_query.all()
        active_ids = [s.id for s in active_students_list]

        gpas = [self._get_student_gpa(sid) for sid in active_ids]
        attendance_rates = [self._get_student_attendance_rate(sid) for sid in active_ids]

        all_grades = [g.value for g in grade_query.all()]

        avg_gpa = _round(sum(gpas) / len(gpas), 2) if gpas else 0.0
        avg_attendance = _round(sum(attendance_rates) / len(attendance_rates), 2) if attendance_rates else 0.0
        at_risk = sum(1 for g in gpas if g < 5.0)
        pass_info = self.stats.compute_pass_rate(all_grades) if all_grades else {"pass_rate": 0.0}
        grade_dist = self.stats.compute_grade_distribution(all_grades) if all_grades else {}

        # Risk summary
        risk_summary = {"low": 0, "medium": 0, "high": 0, "critical": 0}
        for gpa, att in zip(gpas, attendance_rates):
            if gpa < 4.0 or att < 60.0:
                risk_summary["critical"] += 1
            elif gpa < 5.0 or att < 70.0:
                risk_summary["high"] += 1
            elif gpa < 6.0 or att < 80.0:
                risk_summary["medium"] += 1
            else:
                risk_summary["low"] += 1

        # Top at risk students
        student_risks = []
        for s in active_students_list:
            gpa = self._get_student_gpa(s.id)
            att = self._get_student_attendance_rate(s.id)
            risk_score = max(0.0, min(1.0, (1 - gpa / 10) * 0.6 + (1 - att / 100) * 0.4))
            student_risks.append({
                "student_id": s.id,
                "student_name": s.name,
                "registration_number": s.registration_number,
                "gpa": gpa,
                "attendance_rate": att,
                "risk_score": _round(risk_score, 4),
                "risk_level": self._classify_risk(risk_score),
            })
        student_risks.sort(key=lambda x: x["risk_score"], reverse=True)

        return {
            "kpis": {
                "total_students": total_students,
                "active_students": active_students,
                "total_courses": total_courses,
                "average_gpa": avg_gpa,
                "average_attendance_rate": avg_attendance,
                "at_risk_count": at_risk,
                "pass_rate": pass_info.get("pass_rate", 0.0),
            },
            "grade_distribution": grade_dist,
            "risk_summary": risk_summary,
            "top_at_risk": student_risks[:10],
        }

    # ─── Estatísticas Descritivas ───

    def get_grade_stats(self, course_id: int | None = None, course_ids: List[int] = None, student_ids: List[int] = None) -> Dict[str, Any]:
        """Estatísticas descritivas de notas, opcionalmente por disciplina ou conjunto de disciplinas."""
        if course_ids is not None and not course_ids:
            return {
                "summary": {
                    "count": 0, "mean": 0.0, "median": 0.0, "std": 0.0, "variance": 0.0,
                    "min": 0.0, "max": 0.0, "q1": 0.0, "q2": 0.0, "q3": 0.0,
                    "skewness": 0.0, "kurtosis": 0.0
                },
                "histogram": {"counts": [], "bin_edges": []},
                "distribution": {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0},
                "pass_rate": {"pass_rate": 0.0, "passed": 0, "failed": 0, "total": 0}
            }

        query = self.db.query(Grade)
        if course_id:
            query = query.filter(Grade.course_id == course_id)
        if course_ids is not None:
            query = query.filter(Grade.course_id.in_(course_ids))
            
        values = [g.value for g in query.all()]
        if not values:
            return {
                "summary": {
                    "count": 0, "mean": 0.0, "median": 0.0, "std": 0.0, "variance": 0.0,
                    "min": 0.0, "max": 0.0, "q1": 0.0, "q2": 0.0, "q3": 0.0,
                    "skewness": 0.0, "kurtosis": 0.0
                },
                "histogram": {"counts": [], "bin_edges": []},
                "distribution": {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0},
                "pass_rate": {"pass_rate": 0.0, "passed": 0, "failed": 0, "total": 0}
            }
            
        return {
            "summary": self.stats.compute_summary(values),
            "histogram": self.stats.compute_histogram(values),
            "distribution": self.stats.compute_grade_distribution(values),
            "pass_rate": self.stats.compute_pass_rate(values),
        }

    # ─── Correlações ───

    def get_correlations(self, course_ids: List[int] = None, student_ids: List[int] = None) -> Dict[str, Any]:
        """Calcula correlações entre frequência, notas e outros indicadores."""
        if (student_ids is not None and not student_ids) or (course_ids is not None and not course_ids and student_ids is None):
            return {"gpa_vs_attendance": 0, "gpa_vs_failures": 0, "correlation_matrix": []}

        student_query = self.db.query(Student).filter(Student.status == StudentStatus.ACTIVE)
        
        if student_ids is not None:
            student_query = student_query.filter(Student.id.in_(student_ids))
        elif course_ids is not None:
            enrollment_sids = (
                self.db.query(Enrollment.student_id)
                .filter(Enrollment.course_id.in_(course_ids))
                .distinct()
                .all()
            )
            enrollment_sids = [sid[0] for sid in enrollment_sids]
            student_query = student_query.filter(Student.id.in_(enrollment_sids))

        students = student_query.all()

        gpas = []
        attendance_rates = []
        failures = []

        for s in students:
            gpas.append(self._get_student_gpa(s.id))
            attendance_rates.append(self._get_student_attendance_rate(s.id))
            failures.append(float(self._get_student_failures(s.id)))

        if not gpas:
            return {"gpa_vs_attendance": 0, "gpa_vs_failures": 0, "correlation_matrix": []}

        # Correlação entre pares
        gpa_attendance = self.correlations.pearson(gpas, attendance_rates)
        gpa_failures = self.correlations.pearson(gpas, failures)

        # Matriz completa
        matrix = self.correlations.correlation_matrix({
            "GPA": gpas,
            "Frequência (%)": attendance_rates,
            "Reprovações": failures,
        })

        return {
            "gpa_vs_attendance": gpa_attendance,
            "gpa_vs_failures": gpa_failures,
            "correlation_matrix": matrix,
        }

    # ─── PCA ───

    def get_pca_analysis(self, course_ids: List[int] = None, student_ids: List[int] = None) -> Dict[str, Any]:
        """Executa PCA sobre features dos alunos ativos."""
        if (student_ids is not None and not student_ids) or (course_ids is not None and not course_ids and student_ids is None):
            return {"error": "Nenhum aluno vinculado para análise PCA"}

        student_query = self.db.query(Student).filter(Student.status == StudentStatus.ACTIVE)
        
        if student_ids is not None:
            student_query = student_query.filter(Student.id.in_(student_ids))
        elif course_ids is not None:
            enrollment_sids = (
                self.db.query(Enrollment.student_id)
                .filter(Enrollment.course_id.in_(course_ids))
                .distinct()
                .all()
            )
            enrollment_sids = [sid[0] for sid in enrollment_sids]
            student_query = student_query.filter(Student.id.in_(enrollment_sids))

        students = student_query.all()

        if len(students) < 5:
            return {"error": "Mínimo de 5 alunos ativos para análise PCA"}

        features = []
        for s in students:
            features.append([
                self._get_student_gpa(s.id),
                self._get_student_attendance_rate(s.id),
                float(self._get_student_failures(s.id)),
                float(self._get_student_semesters(s.id)),
                self._get_grade_trend(s.id),
            ])

        feature_names = ["GPA", "Frequência", "Reprovações", "Semestres", "Tendência"]
        return self.linalg.pca(features, feature_names=feature_names, n_components=3)

    # ─── Predições ───

    def get_predictions(self, course_ids: List[int] = None, student_ids: List[int] = None) -> Dict[str, Any]:
        """Treina modelos e gera predições para todos os alunos ativos."""
        if (student_ids is not None and not student_ids) or (course_ids is not None and not course_ids and student_ids is None):
            return {"model_info": {}, "predictions": []}

        student_query = self.db.query(Student).filter(Student.status == StudentStatus.ACTIVE)
        
        if student_ids is not None:
            student_query = student_query.filter(Student.id.in_(student_ids))
        elif course_ids is not None:
            enrollment_sids = (
                self.db.query(Enrollment.student_id)
                .filter(Enrollment.course_id.in_(course_ids))
                .distinct()
                .all()
            )
            enrollment_sids = [sid[0] for sid in enrollment_sids]
            student_query = student_query.filter(Student.id.in_(enrollment_sids))

        students = student_query.all()
        if not students:
            return {"model_info": {}, "predictions": []}

        # Montar features
        all_features = []
        all_labels = []
        student_info = []

        for s in students:
            gpa = self._get_student_gpa(s.id)
            att = self._get_student_attendance_rate(s.id)
            failures = self._get_student_failures(s.id)
            semesters = self._get_student_semesters(s.id)
            trend = self._get_grade_trend(s.id)

            feat = [gpa, att, float(failures), float(semesters), trend]
            all_features.append(feat)
            # Label heurístico: aluno com GPA < 4 ou frequência < 60% => 1 (risco)
            label = 1 if (gpa < 4.0 or att < 60.0) else 0
            all_labels.append(label)
            student_info.append({"id": s.id, "name": s.name})

        # Treinar modelo de dropout
        train_result = self.dropout_predictor.train(all_features, all_labels)

        # Predizer para cada aluno
        predictions = self.dropout_predictor.predict(all_features)

        results = []
        for i, pred in enumerate(predictions):
            if "error" in pred:
                continue
            recs = self.recommender.analyze_student(
                student_id=student_info[i]["id"],
                student_name=student_info[i]["name"],
                gpa=all_features[i][0],
                attendance_rate=all_features[i][1],
                failures=int(all_features[i][2]),
                dropout_risk=pred["risk_score"],
            )
            results.append({
                "student_id": student_info[i]["id"],
                "student_name": student_info[i]["name"],
                "risk_score": pred["risk_score"],
                "risk_level": pred["risk_level"],
                "recommendations": recs,
            })

        results.sort(key=lambda x: x["risk_score"], reverse=True)

        return {
            "model_info": train_result,
            "predictions": results,
        }

    # ─── Recomendações ───

    def get_recommendations(self, course_ids: List[int] = None, student_ids: List[int] = None) -> Dict[str, Any]:
        """Gera recomendações para todos os alunos ativos."""
        if (student_ids is not None and not student_ids) or (course_ids is not None and not course_ids and student_ids is None):
            return {"total_recommendations": 0, "recommendations": [], "by_priority": {}}

        student_query = self.db.query(Student).filter(Student.status == StudentStatus.ACTIVE)
        
        if student_ids is not None:
            student_query = student_query.filter(Student.id.in_(student_ids))
        elif course_ids is not None:
            enrollment_sids = (
                self.db.query(Enrollment.student_id)
                .filter(Enrollment.course_id.in_(course_ids))
                .distinct()
                .all()
            )
            enrollment_sids = [sid[0] for sid in enrollment_sids]
            student_query = student_query.filter(Student.id.in_(enrollment_sids))

        students = student_query.all()

        students_data = []
        for s in students:
            gpa = self._get_student_gpa(s.id)
            att = self._get_student_attendance_rate(s.id)
            risk_score = max(0.0, min(1.0, (1 - gpa / 10) * 0.6 + (1 - att / 100) * 0.4))
            students_data.append({
                "student_id": s.id,
                "student_name": s.name,
                "gpa": gpa,
                "attendance_rate": att,
                "failures": self._get_student_failures(s.id),
                "dropout_risk": risk_score,
            })

        return self.recommender.analyze_batch(students_data)

    @staticmethod
    def _classify_risk(score: float) -> str:
        if score >= 0.75:
            return "critical"
        elif score >= 0.50:
            return "high"
        elif score >= 0.25:
            return "medium"
        return "low"
