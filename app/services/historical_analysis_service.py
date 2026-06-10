from __future__ import annotations

from collections import defaultdict
from statistics import mean, pstdev
from typing import Any
import time
import unicodedata

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.coordinator import Coordinator
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.historical_data import HistoricalRecord
from app.models.historical_spreadsheet import HistoricalSpreadsheet
from app.models.professor import Professor, ProfessorCourse
from app.models.scraped_data import ScrapedAttendance, ScrapedGrade, ScrapedSubject
from app.models.student import Student, StudentStatus
from app.models.user import User, UserRole
from app.services.statistical_risk_service import StatisticalRiskService


def _normalize_text(value: str | None) -> str:
    text = unicodedata.normalize("NFKD", value or "")
    ascii_text = text.encode("ascii", "ignore").decode("ascii")
    return " ".join(ascii_text.lower().strip().split())


def _safe_mean(values: list[float], default: float = 0.0) -> float:
    if not values:
        return default
    return round(mean(values), 2)


def _safe_std(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    return round(pstdev(values), 2)


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


class HistoricalAnalysisService:
    _workspace_cache: dict[str, dict[str, Any]] = {}
    _workspace_cache_ttl_seconds = 86400
    _professor_scope_cache: dict[int, dict[str, Any]] = {}
    _professor_scope_cache_ttl_seconds = 3600

    @classmethod
    def clear_workspace_cache(cls):
        cls._workspace_cache.clear()
        cls._professor_scope_cache.clear()

    def __init__(self, db: Session):
        self.db = db
        self.statistical_risk_service = StatisticalRiskService()

    def build_workspace(
        self,
        current_user: User,
        semester: str | None = None,
        course_name: str | None = None,
        subject: str | None = None,
        spreadsheet_id: int | None = None,
    ) -> dict[str, Any]:
        return self.get_workspace_bundle(
            current_user=current_user,
            semester=semester,
            course_name=course_name,
            subject=subject,
            spreadsheet_id=spreadsheet_id,
        )["workspace"]

    def get_workspace_bundle(
        self,
        current_user: User,
        semester: str | None = None,
        course_name: str | None = None,
        subject: str | None = None,
        spreadsheet_id: int | None = None,
    ) -> dict[str, Any]:
        cache_key = self._build_workspace_cache_key(current_user, semester, course_name, subject, spreadsheet_id)
        now = time.monotonic()
        cached = self._workspace_cache.get(cache_key)
        if cached and float(cached.get("expires_at") or 0.0) > now:
            return cached["bundle"]

        records, scope = self.get_scoped_records(
            current_user=current_user,
            semester=semester,
            course_name=course_name,
            subject=subject,
            spreadsheet_id=spreadsheet_id,
        )

        prepared_records = self._prepare_records(records)
        prepared_records = self._enrich_prepared_records(prepared_records)
        prepared_records, model_diagnostics = self.statistical_risk_service.analyze(prepared_records)
        filters = self._build_filters(records)
        available_analyses = self._build_available_analyses(current_user.role)

        empty_analysis = {
            "by_class": [],
            "between_classes": [],
            "by_semester": [],
            "high_risk_classes": [],
            "risk_topics": [],
            "discipline_bottlenecks": [],
            "discipline_risk": [],
            "intervention_priorities": [],
            "student_trends": [],
            "risk_factors": [],
            "early_alerts": [],
            "student_segments": [],
            "risk_projection": [],
            "heatmap": {
                "metrics": [],
                "classes": [],
                "cells": [],
            },
            "intervention_simulator": {
                "baseline": {},
                "scenarios": [],
            },
            "model_diagnostics": self.statistical_risk_service._fallback_context("Sem dados para modelagem."),
        }

        if not prepared_records:
            workspace = {
                "scope": scope,
                "filters": filters,
                "available_analyses": available_analyses,
                "overview": {
                    "total_records": 0,
                    "total_students": 0,
                    "working_students": 0,
                    "total_classes": 0,
                    "total_semesters": 0,
                    "avg_grade": 0.0,
                    "avg_attendance": 0.0,
                    "avg_activity": 0.0,
                    "avg_risk": 0.0,
                    "critical_classes": 0,
                    "model_diagnostics": self.statistical_risk_service._fallback_context("Sem dados para modelagem."),
                },
                "analysis_data": empty_analysis,
            }
            bundle = {"workspace": workspace, "prepared_records": []}
            self._workspace_cache[cache_key] = {
                "expires_at": now + self._workspace_cache_ttl_seconds,
                "bundle": bundle,
            }
            return bundle

        class_groups = self._group_by_class(prepared_records)
        semester_groups = self._group_by_semester(prepared_records)
        subject_groups = self._group_by_subject(prepared_records)
        overview = self._build_overview(prepared_records, class_groups, model_diagnostics)

        workspace = {
            "scope": scope,
            "filters": filters,
            "available_analyses": available_analyses,
            "overview": overview,
            "analysis_data": {
                "by_class": class_groups,
                "between_classes": self._build_between_classes(class_groups, overview),
                "by_semester": semester_groups,
                "high_risk_classes": self._build_high_risk_classes(class_groups),
                "risk_topics": self._build_risk_topics(class_groups, subject_groups, semester_groups),
                "discipline_bottlenecks": self._build_bottlenecks(subject_groups, current_user.role),
                "discipline_risk": self._build_discipline_risk(prepared_records),
                "intervention_priorities": self._build_interventions(class_groups, current_user.role),
                "student_trends": self._build_student_trends(prepared_records),
                "risk_factors": self._build_risk_factors(prepared_records, model_diagnostics),
                "early_alerts": self._build_early_alerts(prepared_records),
                "student_segments": self._build_student_segments(prepared_records),
                "risk_projection": self._build_risk_projection(prepared_records),
                "heatmap": self._build_heatmap(class_groups),
                "intervention_simulator": self._build_intervention_simulator(overview),
                "model_diagnostics": model_diagnostics,
            },
        }
        bundle = {"workspace": workspace, "prepared_records": prepared_records}
        self._workspace_cache[cache_key] = {
            "expires_at": now + self._workspace_cache_ttl_seconds,
            "bundle": bundle,
        }
        return bundle

    def get_scoped_records(
        self,
        current_user: User,
        semester: str | None = None,
        course_name: str | None = None,
        subject: str | None = None,
        spreadsheet_id: int | None = None,
    ) -> tuple[list[HistoricalRecord], dict[str, Any]]:
        query = self.db.query(HistoricalRecord)
        
        # 1. Filtros de Escopo / Autorização
        if current_user.role == UserRole.PROFESSOR:
            query = query.filter(HistoricalRecord.professor_id == current_user.id)
            if spreadsheet_id is None:
                professor = self.db.query(Professor).filter(Professor.user_id == current_user.id).first()
                if professor:
                    academic_courses = [ac.course_name.strip() for ac in professor.academic_courses if ac.course_name]
                    if academic_courses:
                        query = query.filter(or_(*[HistoricalRecord.course_name.ilike(f"%{course}%") for course in academic_courses]))
        elif current_user.role == UserRole.COORDINATOR:
            coordinator = self.db.query(Coordinator).filter(Coordinator.user_id == current_user.id).first()
            if coordinator and coordinator.academic_course_name:
                query = query.filter(HistoricalRecord.course_name.ilike(f"%{coordinator.academic_course_name.strip()}%"))
        
        # 2. Otimização Crítica: Aplicar filtros estruturais diretamente na query do Banco
        if spreadsheet_id is not None:
            query = query.filter(HistoricalRecord.spreadsheet_id == spreadsheet_id)
            
        def clean_param(val: str | None) -> str | None:
            if not val:
                return None
            val_str = str(val).strip()
            if val_str.lower() in ("undefined", "null", "none", "", "all"):
                return None
            return val_str

        semester_clean = clean_param(semester)
        course_clean = clean_param(course_name)
        subject_clean = clean_param(subject)

        if semester_clean:
            query = query.filter(HistoricalRecord.semester == semester_clean)
        if course_clean:
            query = query.filter(HistoricalRecord.course_name.ilike(f"%{course_clean}%"))
        if subject_clean:
            query = query.filter(HistoricalRecord.subject.ilike(f"%{subject_clean}%"))

        all_records = query.order_by(HistoricalRecord.id.desc()).all()
        
        scope = {
            "role": current_user.role.value.lower(),
            "label": "Leitura restrita",
            "description": "Base historica filtrada pelo seu nivel de acesso.",
            "can_upload": current_user.role in (UserRole.PROFESSOR, UserRole.ADMIN),
            "access_level": "restricted",
            "course_name": None,
        }

        if current_user.role == UserRole.PROFESSOR:
            if spreadsheet_id is None:
                professor = self.db.query(Professor).filter(Professor.user_id == current_user.id).first()
                if professor:
                    professor_courses = (
                        self.db.query(Course.name)
                        .join(ProfessorCourse, ProfessorCourse.course_id == Course.id)
                        .filter(ProfessorCourse.professor_id == professor.id)
                        .all()
                    )
                    prof_subject_names = [c[0].strip() for c in professor_courses if c[0] and "metodologia" not in _normalize_text(c[0])]
                    if prof_subject_names:
                        normalized_prof_subjects = {_normalize_text(name) for name in prof_subject_names if name}
                        scoped = [
                            record for record in all_records
                            if _normalize_text(record.subject) in normalized_prof_subjects
                        ]
                    else:
                        scoped = []
                else:
                    scoped = []
                
                # Fallback de segurança: se o filtro estrito de disciplinas resultar vazio,
                # permitimos que o professor veja todos os registros que ele mesmo subiu.
                if not scoped and all_records:
                    scoped = all_records
            else:
                scoped = all_records
            professor_scope = self._get_professor_scope(current_user)
            scope.update({
                "label": "Analises do professor",
                "description": "Comparativos e riscos das suas planilhas e turmas integradas.",
                "access_level": "classroom",
                "course_name": professor_scope["academic_courses"],
                "subject_names": professor_scope["subjects"],
            })
        elif current_user.role == UserRole.COORDINATOR:
            coordinator = self.db.query(Coordinator).filter(Coordinator.user_id == current_user.id).first()
            if not coordinator:
                raise HTTPException(status_code=404, detail="Perfil de coordenador nao encontrado.")

            normalized_course = _normalize_text(coordinator.academic_course_name)
            scoped = [
                record for record in all_records
                if normalized_course
                and (
                    normalized_course in _normalize_text(record.course_name)
                    or _normalize_text(record.course_name) in normalized_course
                )
            ]
            scope.update({
                "label": "Analises da coordenacao",
                "description": "Visao ampliada do curso, com comparativos e prioridades de intervencao.",
                "access_level": "expanded",
                "course_name": coordinator.academic_course_name,
            })
        elif current_user.role == UserRole.ADMIN:
            scoped = all_records
            scope.update({
                "label": "Analises da pro-reitoria",
                "description": "Leitura ampliada da base historica, com acesso a upload e analises docentes em escala institucional.",
                "access_level": "institutional",
            })
        else:
            raise HTTPException(status_code=403, detail="Acesso nao autorizado.")

        # Filtros opcionais defensivos adicionais
        filtered = self._apply_optional_filters(
            records=scoped,
            semester=semester,
            course_name=course_name,
            subject=subject,
        )
        if spreadsheet_id is not None:
            filtered = [r for r in filtered if r.spreadsheet_id == spreadsheet_id]
            
        return filtered, scope

    def _get_professor_scope(self, current_user: User) -> dict[str, Any]:
        # Verificar cache com TTL
        now = time.monotonic()
        cached = self._professor_scope_cache.get(current_user.id)
        if cached and cached.get("expires_at", 0.0) > now:
            return cached["data"]

        professor = self.db.query(Professor).filter(Professor.user_id == current_user.id).first()
        if not professor:
            raise HTTPException(status_code=404, detail="Perfil de professor nao encontrado.")

        academic_courses = [
            course_name.strip()
            for course_name in (ac.course_name for ac in professor.academic_courses)
            if str(course_name or "").strip()
        ]
        academic_course_keys = {
            _normalize_text(name)
            for name in academic_courses
            if _normalize_text(name)
        }

        subject_names: set[str] = set()
        if academic_course_keys:
            # Otimização Crítica: Filtrar alunos por curso usando OR e ILIKE diretamente no banco
            # Evita carregar a tabela Student inteira na memória do servidor
            filters = [Student.course_name.ilike(f"%{course}%") for course in academic_courses]
            student_rows = []
            if filters:
                student_rows = (
                    self.db.query(Student.id, Student.course_name)
                    .filter(
                        Student.status == StudentStatus.ACTIVE,
                        Student.course_name.isnot(None),
                        or_(*filters)
                    )
                    .all()
                )
            
            student_ids = [
                student_id
                for student_id, student_course_name in student_rows
                if student_course_name and self._matches_any_scope(student_course_name, academic_course_keys, allow_contains=True)
            ]

            if student_ids:
                for model, column in [
                    (ScrapedSubject, ScrapedSubject.disciplina),
                    (ScrapedGrade, ScrapedGrade.disciplina),
                    (ScrapedAttendance, ScrapedAttendance.disciplina),
                ]:
                    rows = self.db.query(column).filter(model.student_id.in_(student_ids)).distinct().all()
                    for (value,) in rows:
                        normalized_value = str(value or "").strip()
                        if normalized_value:
                            subject_names.add(normalized_value)

                enrollment_rows = (
                    self.db.query(Course.name)
                    .join(Enrollment, Enrollment.course_id == Course.id)
                    .filter(Enrollment.student_id.in_(student_ids))
                    .distinct()
                    .all()
                )
                for (value,) in enrollment_rows:
                    normalized_value = str(value or "").strip()
                    if normalized_value:
                        subject_names.add(normalized_value)

        # Filtrar as disciplinas para manter apenas as que o professor está associado em ProfessorCourse
        prof_courses = (
            self.db.query(Course.name)
            .join(ProfessorCourse, ProfessorCourse.course_id == Course.id)
            .filter(ProfessorCourse.professor_id == professor.id)
            .all()
        )
        allowed_subjects = {c[0].strip() for c in prof_courses if c[0] and "metodologia" not in _normalize_text(c[0])}
        if allowed_subjects:
            normalized_allowed = {_normalize_text(name) for name in allowed_subjects}
            subject_names = {
                name for name in subject_names
                if _normalize_text(name) in normalized_allowed
            }
        else:
            subject_names = set()

        data = {
            "academic_courses": academic_courses,
            "subjects": sorted(subject_names),
            "academic_course_keys": academic_course_keys,
            "subject_keys": {_normalize_text(name) for name in subject_names if _normalize_text(name)},
        }

        self._professor_scope_cache[current_user.id] = {
            "expires_at": now + self._professor_scope_cache_ttl_seconds,
            "data": data,
        }
        return data
    def _matches_any_scope(self, value: str | None, scope_keys: set[str], allow_contains: bool = True) -> bool:
        normalized_value = _normalize_text(value)
        if not normalized_value:
            return False
        if allow_contains:
            return any(
                scope_key == normalized_value
                or scope_key in normalized_value
                or normalized_value in scope_key
                for scope_key in scope_keys
            )
        return normalized_value in scope_keys

    def _apply_optional_filters(
        self,
        records: list[HistoricalRecord],
        semester: str | None = None,
        course_name: str | None = None,
        subject: str | None = None,
    ) -> list[HistoricalRecord]:
        def clean_param(val: str | None) -> str | None:
            if not val:
                return None
            val_str = str(val).strip()
            if val_str.lower() in ("undefined", "null", "none", "", "all"):
                return None
            return val_str

        semester_clean = clean_param(semester)
        course_clean = clean_param(course_name)
        subject_clean = clean_param(subject)

        semester_key = _normalize_text(semester_clean)
        course_key = _normalize_text(course_clean)
        subject_key = _normalize_text(subject_clean)

        filtered = records
        if semester_key:
            filtered = [record for record in filtered if _normalize_text(record.semester) == semester_key]
        if course_key:
            filtered = [record for record in filtered if course_key in _normalize_text(record.course_name)]
        if subject_key:
            filtered = [record for record in filtered if subject_key in _normalize_text(record.subject)]
        return filtered


    def _build_filters(self, records: list[HistoricalRecord]) -> dict[str, list[str]]:
        semesters = sorted({record.semester for record in records if record.semester}, reverse=True)
        courses = sorted({record.course_name for record in records if record.course_name})
        subjects = sorted({record.subject for record in records if record.subject})
        return {
            "semesters": semesters,
            "courses": courses,
            "subjects": subjects,
        }

    def _build_workspace_cache_key(
        self,
        current_user: User,
        semester: str | None,
        course_name: str | None,
        subject: str | None,
        spreadsheet_id: int | None = None,
    ) -> str:
        record_count, max_record_id = self.db.query(
            func.count(HistoricalRecord.id),
            func.max(HistoricalRecord.id),
        ).one()
        professor_signature = ""
        if current_user.role == UserRole.PROFESSOR:
            # Otimização Crítica: Usar apenas a lista de cursos cadastrados no perfil do professor
            # Evita executar queries pesadas de scraping em _get_professor_scope a cada cálculo de chave de cache
            professor = self.db.query(Professor).filter(Professor.user_id == current_user.id).first()
            if professor:
                professor_signature = ",".join(sorted(ac.course_name for ac in professor.academic_courses if ac.course_name))
        
        spreadsheet_signature = str(spreadsheet_id or "")

        return "|".join([
            str(current_user.id),
            str(current_user.role.value),
            _normalize_text(semester),
            _normalize_text(course_name),
            _normalize_text(subject),
            str(record_count or 0),
            str(max_record_id or 0),
            professor_signature,
            spreadsheet_signature,
        ])

    def _build_available_analyses(self, role: UserRole) -> list[dict[str, str]]:
        base = [
            {
                "id": "overview",
                "label": "Resumo",
                "description": "Painel geral com indicadores do recorte atual.",
            },
            {
                "id": "by_class",
                "label": "Análise por Turma",
                "description": "Notas, presença e engajamento detalhados de cada turma.",
            },
            {
                "id": "discipline_risk",
                "label": "Risco por Disciplina",
                "description": "Mostra quais disciplinas têm maior risco de reprovação ou evasão.",
            },
            {
                "id": "between_classes",
                "label": "Comparar Turmas",
                "description": "Compara as notas e a frequência projetada entre turmas diferentes.",
            },
            {
                "id": "by_semester",
                "label": "Análise por Semestre",
                "description": "Acompanha a evolução de notas e presença ao longo dos semestres.",
            },
            {
                "id": "risk_topics",
                "label": "Tópicos de Alerta",
                "description": "Focos de atenção baseados em queda de notas ou faltas dos alunos.",
            },
            {
                "id": "student_trends",
                "label": "Análise por Aluno",
                "description": "Acompanha o desempenho do aluno para identificar quem precisa de ajuda rápida.",
            },
            {
                "id": "risk_factors",
                "label": "Fatores de Risco",
                "description": "Mostra o que está gerando mais risco (notas baixas, faltas, etc.).",
            },
            {
                "id": "early_alerts",
                "label": "Alertas Rápidos",
                "description": "Alertas imediatos sobre faltas, notas baixas ou pouca atividade.",
            },
            {
                "id": "intervention_simulator",
                "label": "Simulador de Melhorias",
                "description": "Simule como a melhora em notas ou presença ajudaria a reduzir o risco do aluno.",
            },
            {
                "id": "student_segments",
                "label": "Grupos de Alunos",
                "description": "Agrupa os alunos por perfil (ex: notas baixas ou muitas faltas) para ações focadas.",
            },
            {
                "id": "risk_projection",
                "label": "Previsão de Risco",
                "description": "Estima a tendência de risco futuro do aluno para agir antes que se torne crítico.",
            },
            {
                "id": "heatmap",
                "label": "Mapa de Risco",
                "description": "Tabela visual mostrando a situação de risco projetada para as turmas.",
            },
        ]

        if role in (UserRole.COORDINATOR, UserRole.ADMIN):
            base.extend([
                {
                    "id": "discipline_bottlenecks",
                    "label": "Dificuldades por Disciplina",
                    "description": "Identifica disciplinas críticas com maior histórico ou previsão de notas baixas.",
                },
                {
                    "id": "intervention_priorities",
                    "label": "Lista de Prioridades",
                    "description": "Ordem de atendimento com foco nas ações mais urgentes do curso.",
                },
            ])

        return base

    def _build_discipline_risk(self, prepared_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for record in prepared_records:
            subject = record.get("subject") or "Turma sem disciplina"
            grouped[str(subject)].append(record)

        rows: list[dict[str, Any]] = []
        for subject, items in grouped.items():
            avg_risk = round(_safe_mean([float(i.get("risk_score") or 0.0) for i in items]), 4)
            avg_grade = _safe_mean([float(i.get("grade_average") or 0.0) for i in items])
            avg_attendance = _safe_mean([float(i.get("attendance") or 0.0) for i in items])
            critical_students = sum(1 for i in items if i.get("risk_level") in ("critical", "high"))

            real_avg_grade = _safe_mean([float(i.get("real_grade_average") or 0.0) for i in items])
            real_avg_attendance = _safe_mean([float(i.get("real_attendance") or 0.0) for i in items])
            real_avg_risk = round(_safe_mean([float(i.get("real_risk_score") or 0.0) for i in items]), 4)
            is_completed = all(i.get("is_completed", True) for i in items)

            driver_totals: dict[str, float] = defaultdict(float)
            for item in items:
                breakdown = item.get("risk_breakdown") or {}
                for key, value in breakdown.items():
                    try:
                        driver_totals[str(key)] += float(value or 0.0)
                    except (TypeError, ValueError):
                        continue

            top_drivers = [
                key for key, value in sorted(driver_totals.items(), key=lambda kv: kv[1], reverse=True)
                if value > 0.0001
            ][:3]

            rows.append({
                "id": f"discipline::{_normalize_text(subject)}",
                "subject": subject,
                "records": len(items),
                "students": len({i.get("student_name") for i in items if i.get("student_name")}),
                "avg_risk": avg_risk,
                "risk_level": self._classify_risk(avg_risk),
                "critical_students": critical_students,
                "avg_grade": avg_grade,
                "avg_attendance": avg_attendance,
                "top_drivers": top_drivers,
                "real_avg_grade": real_avg_grade,
                "real_avg_attendance": real_avg_attendance,
                "real_avg_risk": real_avg_risk,
                "is_completed": is_completed,
            })

        rows.sort(key=lambda r: (r.get("avg_risk", 0.0), r.get("critical_students", 0)), reverse=True)
        return rows[:40]

    def _risk_breakdown(
        self,
        grade_average: float,
        first_assessment: float | None,
        attendance: float,
        attendance_drop: float,
        activity_score: float,
        grade_std: float,
        approved: bool,
        is_working: bool,
        work_balance_score: float,
        failures: int,
        load: int,
        discipline_difficulty: float,
    ) -> dict[str, float]:
        grade_factor = 1 - _clamp(grade_average / 10, 0.0, 1.0)
        first_grade = grade_average if first_assessment is None else float(first_assessment)
        first_assessment_factor = 1 - _clamp(first_grade / 10, 0.0, 1.0)
        attendance_factor = 1 - _clamp(attendance / 100, 0.0, 1.0)
        activity_factor = 1 - _clamp(activity_score / 100, 0.0, 1.0)
        volatility_factor = _clamp(grade_std / 4, 0.0, 1.0)
        approval_factor = 0.0 if approved else 1.0
        work_factor = work_balance_score if is_working else 0.0
        history_factor = _clamp(failures / 3, 0.0, 1.0)
        load_factor = _clamp((max(0, load - 4)) / 4, 0.0, 1.0)
        difficulty_factor = _clamp(discipline_difficulty, 0.0, 1.0)

        return {
            "nota": round(grade_factor * 0.28, 4),
            "primeira_avaliacao": round(first_assessment_factor * 0.08, 4),
            "presenca": round(attendance_factor * 0.19, 4),
            "queda_presenca": round(_clamp(attendance_drop, 0.0, 1.0) * 0.06, 4),
            "atividade": round(activity_factor * 0.14, 4),
            "oscilacao": round(volatility_factor * 0.05, 4),
            "aprovacao": round(approval_factor * 0.05, 4),
            "historico": round(history_factor * 0.06, 4),
            "carga": round(load_factor * 0.03, 4),
            "dificuldade_disciplina": round(difficulty_factor * 0.03, 4),
            "trabalho": round(work_factor * 0.03, 4),
        }

    def _build_student_trends(self, prepared_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        by_student: dict[str, dict[str, list[dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))
        for record in prepared_records:
            student = record.get("student_name") or "Aluno sem nome"
            semester = record.get("semester") or "Sem periodo"
            by_student[student][semester].append(record)

        rows: list[dict[str, Any]] = []
        for student_name, per_semester in by_student.items():
            ordered_semesters = sorted(per_semester.keys())
            points = []
            for sem in ordered_semesters:
                items = per_semester[sem]
                points.append({
                    "semester": sem,
                    "avg_risk": round(_safe_mean([i.get("risk_score", 0.0) for i in items]), 4),
                    "avg_grade": _safe_mean([i.get("grade_average", 0.0) for i in items]),
                    "avg_attendance": _safe_mean([i.get("attendance", 0.0) for i in items]),
                    "avg_activity": _safe_mean([i.get("activity_score", 0.0) for i in items]),
                })

            first = points[0] if points else None
            last = points[-1] if points else None
            risk_delta = round((last["avg_risk"] - first["avg_risk"]) if first and last else 0.0, 4)
            grade_delta = round((last["avg_grade"] - first["avg_grade"]) if first and last else 0.0, 2)
            attendance_delta = round((last["avg_attendance"] - first["avg_attendance"]) if first and last else 0.0, 2)
            activity_delta = round((last["avg_activity"] - first["avg_activity"]) if first and last else 0.0, 2)

            last_semester = ordered_semesters[-1] if ordered_semesters else None
            last_records = per_semester[last_semester] if last_semester else []
            last_breakdown = last_records[-1].get("risk_breakdown") or {} if last_records else {}

            rows.append({
                "id": f"student::{_normalize_text(student_name)}",
                "student_name": student_name,
                "semesters": len(points),
                "current_risk": last["avg_risk"] if last else 0.0,
                "current_grade": last["avg_grade"] if last else 0.0,
                "current_attendance": last["avg_attendance"] if last else 0.0,
                "current_activity": last["avg_activity"] if last else 0.0,
                "risk_delta": risk_delta,
                "grade_delta": grade_delta,
                "attendance_delta": attendance_delta,
                "activity_delta": activity_delta,
                "trend": points,
                "risk_breakdown": last_breakdown,
            })

        rows.sort(key=lambda r: (r.get("current_risk", 0.0), r.get("risk_delta", 0.0)), reverse=True)
        return rows[:120]

    def _build_risk_factors(self, prepared_records: list[dict[str, Any]], model_diagnostics: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        totals = {
            "nota": 0.0,
            "primeira_avaliacao": 0.0,
            "presenca": 0.0,
            "queda_presenca": 0.0,
            "atividade": 0.0,
            "oscilacao": 0.0,
            "aprovacao": 0.0,
            "historico": 0.0,
            "carga": 0.0,
            "dificuldade_disciplina": 0.0,
            "trabalho": 0.0,
        }
        count = 0
        for record in prepared_records:
            breakdown = record.get("risk_breakdown") or self._risk_breakdown(
                grade_average=float(record.get("grade_average") or 0.0),
                first_assessment=record.get("first_assessment"),
                attendance=float(record.get("attendance") or 0.0),
                attendance_drop=float(record.get("attendance_drop") or 0.0),
                activity_score=float(record.get("activity_score") or 0.0),
                grade_std=float(record.get("grade_std") or 0.0),
                approved=bool(record.get("approved")),
                is_working=bool(record.get("is_working")),
                work_balance_score=float(record.get("work_balance_score") or 0.0),
                failures=int(record.get("student_failures") or 0),
                load=int(record.get("student_load") or 0),
                discipline_difficulty=float(record.get("discipline_difficulty") or 0.0),
            )
            for key in totals:
                totals[key] += breakdown.get(key, 0.0)
            count += 1

        if count == 0:
            return []

        labels = {
            "nota": "Nota",
            "primeira_avaliacao": "Primeira avaliacao",
            "presenca": "Presenca",
            "queda_presenca": "Queda de presenca",
            "atividade": "Atividade",
            "oscilacao": "Oscilacao de notas",
            "aprovacao": "Reprovacao",
            "historico": "Historico de reprovacoes",
            "carga": "Carga de disciplinas",
            "dificuldade_disciplina": "Dificuldade da disciplina",
            "trabalho": "Trabalho",
        }

        total_contribution = sum(totals.values()) / count if count > 0 else 0.0
        total_importance = 0.0
        if model_diagnostics and "factor_importance" in model_diagnostics:
            total_importance = sum(float(model_diagnostics["factor_importance"].get(k, 0.0)) for k in totals)

        rows = []
        for key, total in totals.items():
            avg_contribution = total / count
            model_importance = float((model_diagnostics or {}).get("factor_importance", {}).get(key, 0.0))
            
            # Normalizar a contribuição média para que o total represente 100% da causa raiz
            if total_contribution > 0:
                avg_contribution_percent = round((avg_contribution / total_contribution) * 100, 2)
            else:
                avg_contribution_percent = 0.0

            # Normalizar a importância do modelo para que a soma represente 100%
            if total_importance > 0:
                model_importance_percent = round((model_importance / total_importance) * 100, 2)
            else:
                model_importance_percent = round(model_importance * 100, 2)

            rows.append({
                "id": f"factor::{key}",
                "key": key,
                "label": labels.get(key, key),
                "avg_contribution": round(avg_contribution, 4),
                "avg_contribution_percent": avg_contribution_percent,
                "model_importance": round(model_importance, 4),
                "model_importance_percent": model_importance_percent,
            })
        rows.sort(key=lambda r: (r["avg_contribution"], r.get("model_importance", 0.0)), reverse=True)
        return rows

    def _build_early_alerts(self, prepared_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        alerts: list[dict[str, Any]] = []
        for record in prepared_records:
            risk_score = float(record.get("risk_score") or 0.0)
            grade = float(record.get("grade_average") or 0.0)
            attendance = float(record.get("attendance") or 0.0)
            activity = float(record.get("activity_score") or 0.0)
            is_working = bool(record.get("is_working"))

            tags: list[str] = []
            if risk_score >= 0.58:
                tags.append("Risco alto")
            if grade < 6.0:
                tags.append("Nota baixa")
            if attendance < 75:
                tags.append("Presenca baixa")
            if activity < 55:
                tags.append("Baixa atividade")
            if is_working:
                tags.append("Trabalha")

            if not tags:
                continue

            priority = 0
            priority += 3 if risk_score >= 0.75 else 2 if risk_score >= 0.58 else 0
            priority += 2 if attendance < 65 else 1 if attendance < 75 else 0
            priority += 2 if grade < 5.0 else 1 if grade < 6.0 else 0
            priority += 1 if activity < 45 else 0
            priority += 1 if is_working else 0

            alerts.append({
                "id": f"alert::{record.get('id')}",
                "record_id": record.get("id"),
                "student_id": record.get("student_id"),
                "student_name": record.get("student_name"),
                "class_label": record.get("class_label"),
                "class_key": record.get("class_key"),
                "semester": record.get("semester"),
                "course_name": record.get("course_name"),
                "subject": record.get("subject"),
                "risk_score": round(risk_score, 4),
                "risk_level": record.get("risk_level"),
                "grade_average": round(grade, 2),
                "first_assessment": record.get("first_assessment"),
                "attendance": round(attendance, 2),
                "activity_score": round(activity, 2),
                "attendance_drop": record.get("attendance_drop"),
                "student_failures": record.get("student_failures"),
                "student_load": record.get("student_load"),
                "discipline_difficulty": record.get("discipline_difficulty"),
                "risk_drivers": record.get("risk_drivers") or [],
                "risk_breakdown": record.get("risk_breakdown") or {},
                "tags": tags,
                "priority": priority,
            })

        alerts.sort(key=lambda r: (r.get("priority", 0), r.get("risk_score", 0.0)), reverse=True)
        return alerts[:200]

    def _build_intervention_simulator(self, overview: dict[str, Any]) -> dict[str, Any]:
        baseline_grade = float(overview.get("avg_grade") or 0.0)
        baseline_attendance = float(overview.get("avg_attendance") or 0.0)
        baseline_activity = float(overview.get("avg_activity") or 0.0)

        def simulate(grade: float, attendance: float, activity: float) -> float:
            return self._calculate_risk_score(
                grade_average=grade,
                attendance=attendance,
                activity_score=activity,
                grade_std=1.0,
                approved=grade >= 6.0,
                is_working=False,
                work_balance_score=0.0,
            )

        baseline_risk = simulate(baseline_grade, baseline_attendance, baseline_activity)

        scenarios = [
            {
                "id": "scenario::attendance_plus_10",
                "label": "Se a presenca subir +10%",
                "grade": baseline_grade,
                "attendance": _clamp(baseline_attendance + 10, 0.0, 100.0),
                "activity": baseline_activity,
            },
            {
                "id": "scenario::activity_plus_10",
                "label": "Se a atividade subir +10%",
                "grade": baseline_grade,
                "attendance": baseline_attendance,
                "activity": _clamp(baseline_activity + 10, 0.0, 100.0),
            },
            {
                "id": "scenario::grade_plus_1",
                "label": "Se a nota media subir +1.0",
                "grade": _clamp(baseline_grade + 1.0, 0.0, 10.0),
                "attendance": baseline_attendance,
                "activity": baseline_activity,
            },
            {
                "id": "scenario::attendance_plus_10_activity_plus_10",
                "label": "Se presenca e atividade subirem +10%",
                "grade": baseline_grade,
                "attendance": _clamp(baseline_attendance + 10, 0.0, 100.0),
                "activity": _clamp(baseline_activity + 10, 0.0, 100.0),
            },
        ]

        for scenario in scenarios:
            scenario_risk = simulate(scenario["grade"], scenario["attendance"], scenario["activity"])
            scenario["risk"] = scenario_risk
            scenario["risk_change"] = round(scenario_risk - baseline_risk, 4)
            scenario["risk_change_percent"] = round((scenario_risk - baseline_risk) * 100, 2)

        scenarios.sort(key=lambda s: s.get("risk", 0.0))
        return {
            "baseline": {
                "grade": round(baseline_grade, 2),
                "attendance": round(baseline_attendance, 2),
                "activity": round(baseline_activity, 2),
                "risk": baseline_risk,
            },
            "scenarios": scenarios,
        }

    def _build_student_segments(self, prepared_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        segments: dict[str, list[dict[str, Any]]] = defaultdict(list)

        for record in prepared_records:
            grade = float(record.get("grade_average") or 0.0)
            attendance = float(record.get("attendance") or 0.0)
            activity = float(record.get("activity_score") or 0.0)
            risk = float(record.get("risk_score") or 0.0)

            if risk >= 0.75:
                label = "Risco critico"
            elif risk >= 0.58:
                label = "Risco alto"
            elif grade < 6.0 and attendance < 75:
                label = "Nota e presenca baixas"
            elif grade < 6.0:
                label = "Nota baixa"
            elif attendance < 75:
                label = "Presenca baixa"
            elif activity < 55:
                label = "Baixa atividade"
            else:
                label = "Sem alerta"

            segments[label].append(record)

        rows: list[dict[str, Any]] = []
        for label, items in segments.items():
            rows.append({
                "id": f"segment::{_normalize_text(label)}",
                "label": label,
                "students": len({i.get("student_name") for i in items if i.get("student_name")}),
                "records": len(items),
                "avg_risk": round(_safe_mean([float(i.get("risk_score") or 0.0) for i in items]), 4),
                "avg_grade": _safe_mean([float(i.get("grade_average") or 0.0) for i in items]),
                "avg_attendance": _safe_mean([float(i.get("attendance") or 0.0) for i in items]),
                "avg_activity": _safe_mean([float(i.get("activity_score") or 0.0) for i in items]),
            })

        rows.sort(key=lambda r: (r.get("avg_risk", 0.0), r.get("students", 0)), reverse=True)
        return rows

    def _build_risk_projection(self, prepared_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        trends = self._build_student_trends(prepared_records)
        rows: list[dict[str, Any]] = []

        for item in trends:
            current_risk = float(item.get("current_risk") or 0.0)
            breakdown = item.get("risk_breakdown") or {}

            # Agrupar drivers de risco do breakdown para encontrar a prioridade
            drivers = {
                "nota": breakdown.get("nota", 0.0) + breakdown.get("primeira_avaliacao", 0.0) + breakdown.get("oscilacao", 0.0) + breakdown.get("aprovacao", 0.0) + breakdown.get("historico", 0.0),
                "presenca": breakdown.get("presenca", 0.0) + breakdown.get("queda_presenca", 0.0),
                "atividade": breakdown.get("atividade", 0.0),
            }

            # Encontra a categoria com maior pontuação no breakdown
            max_driver = max(drivers, key=drivers.get) if any(drivers.values()) else "nota"

            if current_risk <= 0.15:
                recommended_action = "Manter Acompanhamento"
                mitigated_risk = current_risk
            elif max_driver == "presenca":
                recommended_action = "Resgatar Presença (+10%)"
                mitigated_risk = round(current_risk * 0.60, 4)  # 40% de redução
            elif max_driver == "atividade":
                recommended_action = "Entregar Atividades (+30%)"
                mitigated_risk = round(current_risk * 0.65, 4)  # 35% de redução
            else:
                recommended_action = "Focar em Notas (+1.5 pts)"
                mitigated_risk = round(current_risk * 0.55, 4)  # 45% de redução

            rows.append({
                "id": f"projection::{item.get('id')}",
                "student_name": item.get("student_name"),
                "current_risk": round(current_risk, 4),
                "recommended_action": recommended_action,
                "mitigated_risk": mitigated_risk,
                "risk_drop": round(current_risk - mitigated_risk, 4),
            })

        # Ordenar os alunos onde a ação preventiva tem o maior impacto prático (maior risk_drop)
        rows.sort(key=lambda r: r.get("risk_drop", 0.0), reverse=True)
        return rows[:120]

    def _build_heatmap(self, class_groups: list[dict[str, Any]]) -> dict[str, Any]:
        metrics = [
            {"id": "risk", "label": "Risco", "type": "percent"},
            {"id": "grade", "label": "Nota", "type": "grade"},
            {"id": "attendance", "label": "Presenca", "type": "percent"},
            {"id": "activity", "label": "Atividade", "type": "percent"},
        ]

        classes = class_groups[:18]
        cells = []
        for group in classes:
            class_id = group.get("id")
            cells.append({"class_id": class_id, "metric": "risk", "value": float(group.get("risk_score") or 0.0)})
            cells.append({"class_id": class_id, "metric": "grade", "value": float(group.get("avg_grade") or 0.0)})
            cells.append({"class_id": class_id, "metric": "attendance", "value": float(group.get("avg_attendance") or 0.0) / 100.0})
            cells.append({"class_id": class_id, "metric": "activity", "value": float(group.get("avg_activity") or 0.0) / 100.0})

        return {
            "metrics": metrics,
            "classes": [
                {
                    "id": group.get("id"),
                    "label": group.get("label"),
                    "semester": group.get("semester"),
                }
                for group in classes
            ],
            "cells": cells,
        }

    def _prepare_records(self, records: list[HistoricalRecord]) -> list[dict[str, Any]]:
        max_activity_points = 1
        activity_points_by_record: dict[int, int] = {}
        student_by_name, student_by_name_and_course = self._build_student_indexes()

        for record in records:
            activity_points = len(self._extract_numeric_grades(record.grades or {}))
            activity_points_by_record[record.id] = activity_points
            max_activity_points = max(max_activity_points, activity_points)

        # Pré-carregar status de conclusão das planilhas para evitar N+1 queries
        spreadsheet_ids = {r.spreadsheet_id for r in records if r.spreadsheet_id}
        spreadsheet_status = {}
        if spreadsheet_ids:
            sheets = self.db.query(HistoricalSpreadsheet.id, HistoricalSpreadsheet.is_completed).filter(
                HistoricalSpreadsheet.id.in_(spreadsheet_ids)
            ).all()
            spreadsheet_status = {s.id: s.is_completed for s in sheets}

        prepared = []
        for record in records:
            matched_student = self._match_student(record, student_by_name, student_by_name_and_course)
            grade_values = self._extract_numeric_grades(record.grades or {})
            grade_average = _safe_mean(grade_values, default=0.0)
            first_assessment = self._extract_first_assessment_grade(record.grades or {})
            attendance = round(float(record.attendance), 2) if record.attendance is not None else 75.0
            attendance = _clamp(attendance, 0.0, 100.0)
            activity_score = round((activity_points_by_record[record.id] / max_activity_points) * 100, 2)
            grade_std = _safe_std(grade_values)
            approval_flag = self._get_approval_flag(record.grades or {}, grade_average)
            is_working = bool(getattr(matched_student, "is_working", False))
            work_schedule = getattr(matched_student, "work_schedule", None)
            work_balance_score = self._calculate_work_balance(attendance, activity_score, is_working)
            risk_score = self._calculate_risk_score(
                grade_average=grade_average,
                attendance=attendance,
                activity_score=activity_score,
                grade_std=grade_std,
                approved=approval_flag,
                is_working=is_working,
                work_balance_score=work_balance_score,
            )

            # --- CÁLCULOS DAS MÉTRICAS REAIS ACUMULADAS (ESTADO ATUAL) ---
            real_grade_values = []
            if record.grades:
                for key, value in record.grades.items():
                    key_name = _normalize_text(key)
                    if any(kw in key_name for kw in ["situacao", "status", "projetada", "✨", "frequencia real"]):
                        continue
                    numeric = self._to_float(value)
                    if numeric is not None:
                        if numeric > 10:
                            numeric = numeric / 10 if numeric <= 100 else 10.0
                        real_grade_values.append(_clamp(numeric, 0.0, 10.0))
            real_grade_average = _safe_mean(real_grade_values, default=0.0)

            real_attendance = None
            if record.grades:
                if "Frequencia Real" in record.grades:
                    real_attendance = self._to_float(record.grades["Frequencia Real"])
                elif "Frequência Real" in record.grades:
                    real_attendance = self._to_float(record.grades["Frequência Real"])
            if real_attendance is None:
                real_attendance = round(float(record.attendance), 2) if record.attendance is not None else 75.0
            real_attendance = _clamp(real_attendance, 0.0, 100.0)

            real_grade_std = _safe_std(real_grade_values)
            real_approval_flag = self._get_approval_flag(record.grades or {}, real_grade_average)
            real_work_balance_score = self._calculate_work_balance(real_attendance, activity_score, is_working)
            real_risk_score = self._calculate_risk_score(
                grade_average=real_grade_average,
                attendance=real_attendance,
                activity_score=activity_score,
                grade_std=real_grade_std,
                approved=real_approval_flag,
                is_working=is_working,
                work_balance_score=real_work_balance_score,
            )
            # -------------------------------------------------------------

            subject_label = record.subject or "Turma sem disciplina"
            class_label = subject_label if not record.period else f"{subject_label} - {record.period}o periodo"
            prepared.append({
                "id": record.id,
                "student_id": getattr(matched_student, "id", None),
                "registration_number": getattr(matched_student, "registration_number", None),
                "semester": record.semester or "Sem periodo",
                "course_name": record.course_name or "Curso nao informado",
                "subject": subject_label,
                "period": record.period,
                "class_label": class_label,
                "student_name": record.student_name,
                "grade_average": round(grade_average, 2),
                "first_assessment": first_assessment,
                "attendance": round(attendance, 2),
                "activity_score": activity_score,
                "grade_std": grade_std,
                "approved": approval_flag,
                "risk_score": risk_score,
                "risk_level": self._classify_risk(risk_score),
                "is_working": is_working,
                "work_schedule": work_schedule,
                "work_balance_score": work_balance_score,
                "risk_breakdown": {},
                "risk_drivers": [],
                "student_failures": 0,
                "student_load": 0,
                "attendance_drop": 0.0,
                "discipline_difficulty": 0.0,
                "class_key": f"{class_label}::{record.semester or 'Sem periodo'}::{record.course_name or 'Curso'}",
                "is_completed": spreadsheet_status.get(record.spreadsheet_id, True),
                "real_grade_average": round(real_grade_average, 2),
                "real_attendance": round(real_attendance, 2),
                "real_risk_score": real_risk_score,
            })
        return prepared

    def _extract_first_assessment_grade(self, grades: dict[str, Any]) -> float | None:
        if not grades:
            return None
        numeric_items: list[tuple[str, float]] = []
        for key, value in grades.items():
            key_name = _normalize_text(key)
            if "situacao" in key_name or "status" in key_name:
                continue
            numeric = self._to_float(value)
            if numeric is None:
                continue
            if numeric > 10:
                numeric = numeric / 10 if numeric <= 100 else 10.0
            numeric_items.append((str(key), _clamp(float(numeric), 0.0, 10.0)))
        if not numeric_items:
            return None
        numeric_items.sort(key=lambda item: _normalize_text(item[0]))
        return round(numeric_items[0][1], 2)

    def _enrich_prepared_records(self, prepared_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not prepared_records:
            return prepared_records

        by_student: dict[str, list[dict[str, Any]]] = defaultdict(list)
        by_subject: dict[str, list[dict[str, Any]]] = defaultdict(list)

        for row in prepared_records:
            student_name = row.get("student_name") or "Aluno sem nome"
            subject = row.get("subject") or "Turma sem disciplina"
            by_student[student_name].append(row)
            by_subject[subject].append(row)

        student_failures = {
            name: sum(1 for item in items if not bool(item.get("approved")))
            for name, items in by_student.items()
        }
        student_avg_attendance = {
            name: _safe_mean([float(item.get("attendance") or 0.0) for item in items], default=0.0)
            for name, items in by_student.items()
        }

        student_load_index: dict[tuple[str, str], int] = {}
        for name, items in by_student.items():
            by_sem: dict[str, set[str]] = defaultdict(set)
            for item in items:
                by_sem[str(item.get("semester") or "Sem periodo")].add(str(item.get("subject") or "Turma sem disciplina"))
            for sem, subjects in by_sem.items():
                student_load_index[(name, sem)] = len(subjects)

        subject_difficulty: dict[str, float] = {}
        for subject, items in by_subject.items():
            avg_grade = _safe_mean([float(item.get("grade_average") or 0.0) for item in items], default=0.0)
            pass_rate = (sum(1 for item in items if bool(item.get("approved"))) / len(items)) if items else 1.0
            difficulty = (1 - _clamp(avg_grade / 10, 0.0, 1.0)) * 0.55 + (1 - _clamp(pass_rate, 0.0, 1.0)) * 0.45
            subject_difficulty[subject] = round(_clamp(difficulty, 0.0, 1.0), 4)

        for row in prepared_records:
            student_name = row.get("student_name") or "Aluno sem nome"
            semester = str(row.get("semester") or "Sem periodo")
            subject = row.get("subject") or "Turma sem disciplina"

            failures = int(student_failures.get(student_name, 0))
            load = int(student_load_index.get((student_name, semester), 0))
            avg_att = float(student_avg_attendance.get(student_name, 0.0))
            attendance = float(row.get("attendance") or 0.0)

            attendance_drop = _clamp((avg_att - attendance) / 30, 0.0, 1.0) if avg_att else 0.0
            discipline_difficulty = float(subject_difficulty.get(subject, 0.0))

            breakdown = self._risk_breakdown(
                grade_average=float(row.get("grade_average") or 0.0),
                first_assessment=row.get("first_assessment"),
                attendance=attendance,
                attendance_drop=attendance_drop,
                activity_score=float(row.get("activity_score") or 0.0),
                grade_std=float(row.get("grade_std") or 0.0),
                approved=bool(row.get("approved")),
                is_working=bool(row.get("is_working")),
                work_balance_score=float(row.get("work_balance_score") or 0.0),
                failures=failures,
                load=load,
                discipline_difficulty=discipline_difficulty,
            )

            risk_score = round(sum(breakdown.values()), 4)
            drivers = sorted(breakdown.items(), key=lambda item: item[1], reverse=True)
            row.update({
                "student_failures": failures,
                "student_load": load,
                "attendance_drop": round(attendance_drop, 4),
                "discipline_difficulty": round(discipline_difficulty, 4),
                "risk_breakdown": breakdown,
                "risk_score": risk_score,
                "risk_level": self._classify_risk(risk_score),
                "risk_drivers": [key for key, value in drivers if value > 0.0001][:4],
            })

        return prepared_records

    def _build_student_indexes(self) -> tuple[dict[str, Student], dict[tuple[str, str], Student]]:
        students = self.db.query(Student).all()
        by_name: dict[str, Student] = {}
        by_name_and_course: dict[tuple[str, str], Student] = {}

        for student in students:
            name_key = _normalize_text(student.name)
            course_key = _normalize_text(student.course_name)
            if name_key and name_key not in by_name:
                by_name[name_key] = student
            if name_key and course_key and (name_key, course_key) not in by_name_and_course:
                by_name_and_course[(name_key, course_key)] = student

        return by_name, by_name_and_course

    def _match_student(
        self,
        record: HistoricalRecord,
        student_by_name: dict[str, Student],
        student_by_name_and_course: dict[tuple[str, str], Student],
    ) -> Student | None:
        name_key = _normalize_text(record.student_name)
        course_key = _normalize_text(record.course_name)
        if not name_key:
            return None
        return student_by_name_and_course.get((name_key, course_key)) or student_by_name.get(name_key)

    def _extract_numeric_grades(self, grades: dict[str, Any]) -> list[float]:
        values: list[float] = []
        for key, value in grades.items():
            key_name = _normalize_text(key)
            if "situacao" in key_name or "status" in key_name:
                continue
            numeric = self._to_float(value)
            if numeric is None:
                continue
            if numeric > 10:
                numeric = numeric / 10 if numeric <= 100 else 10.0
            values.append(_clamp(numeric, 0.0, 10.0))
        return values

    def _to_float(self, value: Any) -> float | None:
        if isinstance(value, bool) or value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        text = str(value).strip().replace(",", ".")
        try:
            return float(text)
        except ValueError:
            return None

    def _get_approval_flag(self, grades: dict[str, Any], grade_average: float) -> bool:
        for key, value in grades.items():
            key_name = _normalize_text(key)
            if "situacao" not in key_name and "status" not in key_name:
                continue
            status_text = _normalize_text(str(value))
            if "reprov" in status_text:
                return False
            if "aprov" in status_text:
                return True
        return grade_average >= 6.0

    def _calculate_risk_score(
        self,
        grade_average: float,
        attendance: float,
        activity_score: float,
        grade_std: float,
        approved: bool,
        is_working: bool,
        work_balance_score: float,
    ) -> float:
        grade_factor = 1 - _clamp(grade_average / 10, 0.0, 1.0)
        attendance_factor = 1 - _clamp(attendance / 100, 0.0, 1.0)
        activity_factor = 1 - _clamp(activity_score / 100, 0.0, 1.0)
        volatility_factor = _clamp(grade_std / 4, 0.0, 1.0)
        approval_factor = 0.0 if approved else 1.0
        work_factor = work_balance_score if is_working else 0.0

        risk = (
            grade_factor * 0.38
            + attendance_factor * 0.26
            + activity_factor * 0.17
            + volatility_factor * 0.05
            + approval_factor * 0.07
            + work_factor * 0.07
        )
        return round(_clamp(risk, 0.0, 1.0), 4)

    def _calculate_work_balance(self, attendance: float, activity_score: float, is_working: bool) -> float:
        if not is_working:
            return 0.0
        overload = 0.0
        if attendance < 80:
            overload += (80 - attendance) / 80
        if activity_score < 75:
            overload += (75 - activity_score) / 75
        return round(_clamp(overload / 2, 0.0, 1.0), 4)

    def _classify_risk(self, risk_score: float) -> str:
        if risk_score >= 0.75:
            return "critical"
        if risk_score >= 0.58:
            return "high"
        if risk_score >= 0.38:
            return "medium"
        return "low"

    def _build_overview(
        self,
        prepared_records: list[dict[str, Any]],
        class_groups: list[dict[str, Any]],
        model_diagnostics: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        student_names = {record["student_name"] for record in prepared_records if record["student_name"]}
        working_students = {record["student_name"] for record in prepared_records if record["is_working"]}
        critical_classes = [group for group in class_groups if group["risk_level"] in ("high", "critical")]
        
        # Agrupamento de alunos únicos por curso
        students_by_course = defaultdict(set)
        for record in prepared_records:
            student = record.get("student_name")
            course = record.get("course_name") or "Desconhecido"
            if student and course:
                students_by_course[course].add(student)
        
        course_distribution = {
            course: len(students) for course, students in students_by_course.items()
        }

        # Calcular top_at_risk do histórico
        student_records = {}
        for row in prepared_records:
            sid = row.get("student_id")
            sname = row.get("student_name")
            key = sid if sid else sname
            if key not in student_records or row.get("risk_score", 0.0) > student_records[key].get("risk_score", 0.0):
                student_records[key] = row

        sorted_students = sorted(student_records.values(), key=lambda r: r.get("risk_score", 0.0), reverse=True)
        top_at_risk = []
        for r in sorted_students[:10]:
            h = abs(hash(r.get("student_name"))) % 100000000
            top_at_risk.append({
                "student_id": r.get("student_id"),
                "student_name": r.get("student_name"),
                "registration_number": r.get("registration_number") or f"ALU-{h}",
                "course_name": r.get("course_name"),
                "gpa": r.get("grade_average"),
                "attendance_rate": r.get("attendance"),
                "risk_score": r.get("risk_score"),
                "risk_level": r.get("risk_level"),
            })

        is_projected = any(not record.get("is_completed", True) for record in prepared_records)
        preventive_risk_count = sum(1 for record in prepared_records if record.get("risk_level") in ("high", "critical")) if is_projected else 0

        return {
            "total_records": len(prepared_records),
            "total_students": len(student_names),
            "working_students": len(working_students),
            "total_classes": len(class_groups),
            "total_semesters": len({record["semester"] for record in prepared_records}),
            "avg_grade": _safe_mean([record["grade_average"] for record in prepared_records]),
            "avg_attendance": _safe_mean([record["attendance"] for record in prepared_records]),
            "avg_activity": _safe_mean([record["activity_score"] for record in prepared_records]),
            "avg_risk": round(_safe_mean([record["risk_score"] for record in prepared_records]), 4),
            "real_avg_grade": round(_safe_mean([record.get("real_grade_average", 0.0) for record in prepared_records]), 2),
            "real_avg_attendance": round(_safe_mean([record.get("real_attendance", 75.0) for record in prepared_records]), 2),
            "real_avg_risk": round(_safe_mean([record.get("real_risk_score", 0.0) for record in prepared_records]), 4),
            "critical_classes": len(critical_classes),
            "course_distribution": course_distribution,
            "model_diagnostics": model_diagnostics or self.statistical_risk_service._fallback_context("Modelagem indisponivel."),
            "top_at_risk": top_at_risk,
            "is_projected": is_projected,
            "preventive_risk_count": preventive_risk_count,
        }


    def _group_by_class(self, prepared_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for record in prepared_records:
            grouped[record["class_key"]].append(record)

        groups = []
        for class_key, items in grouped.items():
            sample = items[0]
            groups.append(self._build_group_payload(
                items=items,
                label=sample["class_label"],
                semester=sample["semester"],
                course_name=sample["course_name"],
                group_id=class_key,
                subject=sample["subject"],
                period=sample["period"],
            ))

        groups.sort(key=lambda item: item["risk_score"], reverse=True)
        return groups

    def _group_by_semester(self, prepared_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for record in prepared_records:
            grouped[record["semester"]].append(record)

        semester_items = []
        previous_grade = None
        previous_risk = None
        for semester in sorted(grouped.keys()):
            items = grouped[semester]
            avg_grade = _safe_mean([item["grade_average"] for item in items])
            avg_risk = round(_safe_mean([item["risk_score"] for item in items]), 4)
            avg_attendance = _safe_mean([item["attendance"] for item in items])
            avg_activity = _safe_mean([item["activity_score"] for item in items])
            pass_rate = round(sum(1 for item in items if item["approved"]) / len(items) * 100, 2)
            working_share = round(sum(1 for item in items if item["is_working"]) / len(items) * 100, 2)
            semester_items.append({
                "id": f"semester::{semester}",
                "semester": semester,
                "records": len(items),
                "students": len({item["student_name"] for item in items}),
                "avg_grade": avg_grade,
                "avg_attendance": avg_attendance,
                "avg_activity": avg_activity,
                "avg_risk": avg_risk,
                "pass_rate": pass_rate,
                "working_share": working_share,
                "grade_delta": round(avg_grade - previous_grade, 2) if previous_grade is not None else 0.0,
                "risk_delta": round(avg_risk - previous_risk, 4) if previous_risk is not None else 0.0,
            })
            previous_grade = avg_grade
            previous_risk = avg_risk

        return semester_items

    def _group_by_subject(self, prepared_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for record in prepared_records:
            grouped[record["subject"]].append(record)

        subject_items = []
        for subject, items in grouped.items():
            subject_items.append(self._build_group_payload(
                items=items,
                label=subject,
                semester="Todos",
                course_name=items[0]["course_name"],
                group_id=subject,
                subject=subject,
                period=None,
            ))
        subject_items.sort(key=lambda item: item["priority_index"], reverse=True)
        return subject_items

    def _build_group_payload(
        self,
        items: list[dict[str, Any]],
        label: str,
        semester: str,
        course_name: str,
        group_id: str,
        subject: str,
        period: int | None,
    ) -> dict[str, Any]:
        avg_grade = _safe_mean([item["grade_average"] for item in items])
        avg_attendance = _safe_mean([item["attendance"] for item in items])
        avg_activity = _safe_mean([item["activity_score"] for item in items])
        avg_risk = round(_safe_mean([item["risk_score"] for item in items]), 4)
        grade_std = _safe_std([item["grade_average"] for item in items])
        pass_rate = round(sum(1 for item in items if item["approved"]) / len(items) * 100, 2)
        critical_students = sum(1 for item in items if item["risk_level"] in ("high", "critical"))
        risk_share = critical_students / len(items)
        working_students = sum(1 for item in items if item["is_working"])
        working_share = round((working_students / len(items)) * 100, 2)
        priority_index = round(
            avg_risk * 43
            + (1 - pass_rate / 100) * 22
            + (1 - avg_attendance / 100) * 15
            + (1 - avg_activity / 100) * 12
            + (working_share / 100) * 8,
            2,
        )
        at_risk_students = self._serialize_priority_students(items, limit=4)
        is_projected = any(not item.get("is_completed", True) for item in items)

        real_avg_grade = _safe_mean([item.get("real_grade_average", 0.0) for item in items])
        real_avg_attendance = _safe_mean([item.get("real_attendance", 75.0) for item in items])
        real_avg_risk = round(_safe_mean([item.get("real_risk_score", 0.0) for item in items]), 4)

        return {
            "id": group_id,
            "label": label,
            "subject": subject,
            "semester": semester,
            "course_name": course_name,
            "period": period,
            "students": len({item["student_name"] for item in items}),
            "records": len(items),
            "avg_grade": avg_grade,
            "avg_attendance": avg_attendance,
            "avg_activity": avg_activity,
            "grade_variability": grade_std,
            "pass_rate": pass_rate,
            "risk_score": avg_risk,
            "risk_level": self._classify_risk(avg_risk + risk_share * 0.15),
            "critical_students": critical_students,
            "working_students": working_students,
            "working_share": working_share,
            "priority_index": priority_index,
            "recommended_focus": self._build_focus_message(avg_grade, avg_attendance, avg_activity, avg_risk, working_share),
            "at_risk_students": at_risk_students,
            "is_projected": is_projected,
            "preventive_risk_count": critical_students,
            "real_avg_grade": real_avg_grade,
            "real_avg_attendance": real_avg_attendance,
            "real_avg_risk": real_avg_risk,
        }

    def _build_between_classes(
        self,
        class_groups: list[dict[str, Any]],
        overview: dict[str, Any],
    ) -> list[dict[str, Any]]:
        grade_baseline = overview["avg_grade"] or 0.0
        attendance_baseline = overview["avg_attendance"] or 0.0
        risk_baseline = overview["avg_risk"] or 0.0
        activity_baseline = overview["avg_activity"] or 0.0

        comparisons = []
        for item in class_groups:
            comparisons.append({
                **item,
                "grade_delta": round(item["avg_grade"] - grade_baseline, 2),
                "attendance_delta": round(item["avg_attendance"] - attendance_baseline, 2),
                "activity_delta": round(item["avg_activity"] - activity_baseline, 2),
                "risk_delta": round(item["risk_score"] - risk_baseline, 4),
            })
        return comparisons

    def _build_high_risk_classes(self, class_groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
        ranked = sorted(
            class_groups,
            key=lambda item: (item["risk_score"], item["critical_students"], item["priority_index"]),
            reverse=True,
        )
        seen_labels = set()
        unique_ranked = []
        for item in ranked:
            label = item.get("label")
            if label and label not in seen_labels:
                seen_labels.add(label)
                unique_ranked.append(item)
        return unique_ranked[:8]

    def _build_risk_topics(
        self,
        class_groups: list[dict[str, Any]],
        subject_groups: list[dict[str, Any]],
        semester_groups: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        topics: list[dict[str, Any]] = []

        for item in subject_groups[:4]:
            topics.append({
                "id": f"subject::{item['id']}",
                "type": "Disciplina",
                "label": item["label"],
                "course_name": item["course_name"],
                "semester": item["semester"],
                "risk_level": item["risk_level"],
                "risk_score": item["risk_score"],
                "affected_students": item["critical_students"],
                "signal": self._build_topic_signal(item["avg_grade"], item["avg_attendance"], item["avg_activity"]),
                "evidence": self._build_topic_evidence(item),
                "recommendation": item["recommended_focus"],
            })

        for item in class_groups[:3]:
            topics.append({
                "id": f"class::{item['id']}",
                "type": "Turma",
                "label": item["label"],
                "course_name": item["course_name"],
                "semester": item["semester"],
                "risk_level": item["risk_level"],
                "risk_score": item["risk_score"],
                "affected_students": item["critical_students"],
                "signal": "Turma com concentracao relevante de alunos em alerta.",
                "evidence": self._build_topic_evidence(item),
                "recommendation": item["recommended_focus"],
            })

        for item in semester_groups:
            if item["avg_risk"] >= 0.58 or item["grade_delta"] <= -0.4:
                topics.append({
                    "id": item["id"],
                    "type": "Semestre",
                    "label": item["semester"],
                    "course_name": "Base consolidada",
                    "semester": item["semester"],
                    "risk_level": self._classify_risk(item["avg_risk"]),
                    "risk_score": item["avg_risk"],
                    "affected_students": item["students"],
                    "signal": "Periodo com piora relevante de risco ou queda de nota.",
                    "evidence": (
                        f"Nota media {item['avg_grade']:.2f}, risco {item['avg_risk'] * 100:.0f}%, "
                        f"presenca {item['avg_attendance']:.1f}%."
                    ),
                    "recommendation": self._build_semester_recommendation(item),
                })

        topics.sort(key=lambda item: (item["risk_score"], item["affected_students"]), reverse=True)
        return topics[:8]

    def _build_bottlenecks(self, subject_groups: list[dict[str, Any]], role: UserRole) -> list[dict[str, Any]]:
        if role not in (UserRole.COORDINATOR, UserRole.ADMIN):
            return []
        ranked = sorted(subject_groups, key=lambda item: item["priority_index"], reverse=True)
        return ranked[:8]

    def _build_interventions(self, class_groups: list[dict[str, Any]], role: UserRole) -> list[dict[str, Any]]:
        if role not in (UserRole.COORDINATOR, UserRole.ADMIN):
            return []

        interventions = []
        for item in sorted(class_groups, key=lambda group: group["priority_index"], reverse=True)[:6]:
            reasons = []
            if item["avg_grade"] < 6:
                reasons.append("rever estrategia de notas e recuperacao")
            if item["avg_attendance"] < 75:
                reasons.append("atuar em presenca e busca ativa")
            if item["avg_activity"] < 70:
                reasons.append("aumentar adesao em atividades e entregas")
            if item["working_share"] >= 35:
                reasons.append("avaliar suporte extra para alunos que conciliam trabalho e estudo")
            if item["grade_variability"] > 2:
                reasons.append("monitorar dispersao de desempenho entre alunos")
            if not reasons:
                reasons.append("acompanhar manutencao do desempenho atual")

            interventions.append({
                "id": item["id"],
                "label": item["label"],
                "semester": item["semester"],
                "course_name": item["course_name"],
                "priority_index": item["priority_index"],
                "risk_score": item["risk_score"],
                "recommended_actions": reasons,
            })
        return interventions

    def _build_focus_message(
        self,
        avg_grade: float,
        avg_attendance: float,
        avg_activity: float,
        avg_risk: float,
        working_share: float,
    ) -> str:
        if avg_risk >= 0.75:
            return "Intervencao imediata: combinar reforco academico, busca ativa e revisao da avaliacao."
        if avg_grade < 6 and avg_attendance < 75:
            return "Atuar simultaneamente em nota e presenca para reduzir o risco da turma."
        if working_share >= 35 and avg_activity < 75:
            return "Rever carga de atividades e prazos, porque parte relevante da turma concilia trabalho e estudo."
        if avg_activity < 70:
            return "Reforcar atividades avaliativas e acompanhamento de entregas."
        if avg_grade < 6:
            return "Revisar conteudo, recuperacao e distribuicao de desempenho."
        return "Turma estavel, com espaco para consolidar praticas que mantenham o desempenho."

    def _build_topic_signal(self, avg_grade: float, avg_attendance: float, avg_activity: float) -> str:
        if avg_grade < 6 and avg_attendance < 75:
            return "Baixa nota e presenca insuficiente aparecem juntas neste recorte."
        if avg_activity < 70:
            return "Engajamento em atividades ficou abaixo do esperado."
        if avg_grade < 6:
            return "Resultado academico abaixo da faixa recomendada."
        return "Sinal preventivo para evitar piora nos proximos ciclos."

    def _build_topic_evidence(self, item: dict[str, Any]) -> str:
        return (
            f"Nota media {item['avg_grade']:.2f}, presenca {item['avg_attendance']:.1f}%, "
            f"atividade {item['avg_activity']:.1f}% e {item['critical_students']} alunos em alerta."
        )

    def _build_semester_recommendation(self, semester_item: dict[str, Any]) -> str:
        if semester_item["grade_delta"] <= -0.4:
            return "Comparar matriz, avaliacao e adesao das atividades com o semestre anterior."
        if semester_item["avg_attendance"] < 75:
            return "Fortalecer acompanhamento de presenca e acionar busca ativa ainda no inicio do periodo."
        return "Monitorar as disciplinas mais sensiveis e revisar os pontos de queda do semestre."

    def _select_priority_students(self, rows: list[dict[str, Any]], limit: int = 4) -> list[dict[str, Any]]:
        ranked = sorted(
            rows,
            key=lambda row: (
                row.get("risk_score") or 0.0,
                -(row.get("grade_average") or 0.0),
                -(row.get("attendance") or 0.0),
            ),
            reverse=True,
        )
        priority_rows = [row for row in ranked if row.get("risk_level") in ("critical", "high")]
        if len(priority_rows) < limit:
            medium_rows = [row for row in ranked if row.get("risk_level") == "medium"]
            seen_ids = {row.get("id") for row in priority_rows}
            for row in medium_rows:
                if row.get("id") in seen_ids:
                    continue
                priority_rows.append(row)
                seen_ids.add(row.get("id"))
                if len(priority_rows) >= limit:
                    break
        return priority_rows[:limit]

    def _serialize_at_risk_student(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "record_id": row.get("id"),
            "student_id": row.get("student_id"),
            "student_name": row.get("student_name"),
            "course_name": row.get("course_name"),
            "semester": row.get("semester"),
            "subject": row.get("subject"),
            "period": row.get("period"),
            "risk_score": row.get("risk_score"),
            "risk_level": row.get("risk_level"),
            "grade_average": row.get("grade_average"),
            "first_assessment": row.get("first_assessment"),
            "attendance": row.get("attendance"),
            "activity_score": row.get("activity_score"),
            "approved": row.get("approved"),
            "is_working": row.get("is_working"),
            "attendance_drop": row.get("attendance_drop"),
            "student_failures": row.get("student_failures"),
            "student_load": row.get("student_load"),
            "discipline_difficulty": row.get("discipline_difficulty"),
            "risk_drivers": row.get("risk_drivers") or [],
            "risk_breakdown": row.get("risk_breakdown") or {},
        }

    def _serialize_priority_students(self, rows: list[dict[str, Any]], limit: int = 4) -> list[dict[str, Any]]:
        return [self._serialize_at_risk_student(row) for row in self._select_priority_students(rows, limit=limit)]
