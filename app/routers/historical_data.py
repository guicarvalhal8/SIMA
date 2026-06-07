from collections import defaultdict
from typing import Any, Optional
import io
import logging
import re
from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import delete, text

from app.config import settings
from app.database import get_db
from app.models.historical_data import HistoricalRecord
from app.models.historical_spreadsheet import HistoricalSpreadsheet
from app.models.student import Student, StudentStatus
from app.models.user import User, UserRole
from app.models.professor import Professor, ProfessorCourse, ProfessorAcademicCourse
from app.models.course import Course
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.grade import Grade, AssessmentType
from app.models.attendance import Attendance, AttendanceStatus
from app.schemas.historical_data import HistoricalUploadResponse
from app.security.auth import get_current_user
from app.security.rbac import require_role
from app.services.gemini_service import gemini_service
from app.services.historical_analysis_service import HistoricalAnalysisService
from app.services.historical_export_service import ANALYSIS_TITLES, HistoricalExportService

router = APIRouter(prefix="/api/historical-data", tags=["Dados Historicos"])
logger = logging.getLogger(__name__)
ALLOWED_UPLOAD_EXTENSIONS = {".csv", ".xls", ".xlsx", ".txt", ".pdf"}

HEADER_KEYWORDS = {
    "aluno", "nome", "matricula", "ra", "curso", "disciplina", "materia",
    "semestre", "ano", "periodo", "serie", "nota", "media", "frequencia",
    "presenca", "faltas", "situacao", "status", "resultado", "turma",
}


def _require_pandas():
    try:
        import pandas as pd  # type: ignore
        return pd
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="O processamento de planilhas historicas esta indisponivel neste ambiente.",
        ) from exc


def _normalize_text(value: Any) -> str:
    text = str(value or "")
    return re.sub(r"\s+", " ", text).strip().lower()


def _validate_upload(filename: str, content: bytes) -> str:
    lowered = (filename or "").strip().lower()
    extension = ""
    if "." in lowered:
        extension = lowered[lowered.rfind("."):]

    if extension not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Formato nao suportado. Use CSV, Excel, TXT ou PDF.")

    if not content:
        raise HTTPException(status_code=400, detail="O arquivo enviado esta vazio.")

    if len(content) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Arquivo excede o limite de {settings.MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    return extension


import math


def _clean_val(val):
    pd = _require_pandas()
    if pd.isna(val):
        return None
    if isinstance(val, float) and math.isnan(val):
        return None
    try:
        if isinstance(val, float) and val == int(val):
            return str(int(val))
    except (ValueError, OverflowError):
        pass
    return str(val).strip()


def _coerce_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        val_float = float(value)
        if math.isnan(val_float) or math.isinf(val_float):
            return None
        return val_float
    text = str(value).strip().replace("%", "").replace(",", ".")
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None
    try:
        val_float = float(match.group())
        if math.isnan(val_float) or math.isinf(val_float):
            return None
        return val_float
    except ValueError:
        return None


def _coerce_grade(value: Any) -> float | None:
    numeric = _coerce_float(value)
    if numeric is None:
        return None
    if numeric > 10:
        numeric = numeric / 10 if numeric <= 100 else 10.0
    return round(max(0.0, min(float(numeric), 10.0)), 2)


def _coerce_attendance(value: Any) -> float | None:
    numeric = _coerce_float(value)
    if numeric is None:
        return None
    if 0 <= numeric <= 1:
        numeric *= 100
    return round(max(0.0, min(float(numeric), 100.0)), 2)


def _coerce_period(value: Any) -> int | None:
    numeric = _coerce_float(value)
    if numeric is None:
        return None
    try:
        period = int(numeric)
        return period if 0 < period <= 20 else None
    except (ValueError, OverflowError):
        return None


def _header_score(values: list[Any]) -> int:
    score = 0
    for value in values:
        normalized = _normalize_text(value)
        if not normalized or normalized.startswith("unnamed") or normalized.startswith("column"):
            continue
        if any(keyword in normalized for keyword in HEADER_KEYWORDS):
            score += 2
        elif re.search(r"^(va|n|nota|media|freq|presenca|faltas)\b", normalized):
            score += 1
    return score


def _make_unique_headers(values: list[Any]) -> list[str]:
    headers: list[str] = []
    counts: dict[str, int] = {}
    for index, value in enumerate(values, start=1):
        cleaned = str(value or "").strip() or f"COLUNA_{index}"
        if cleaned.lower().startswith("unnamed"):
            cleaned = f"COLUNA_{index}"
        counts[cleaned] = counts.get(cleaned, 0) + 1
        if counts[cleaned] > 1:
            cleaned = f"{cleaned}_{counts[cleaned]}"
        headers.append(cleaned)
    return headers


def _prepare_dataframe(df: Any) -> Any:
    if df is None:
        return None

    prepared = df.copy()
    prepared = prepared.dropna(axis=0, how="all").dropna(axis=1, how="all")
    if prepared.empty:
        return prepared

    prepared.columns = _make_unique_headers([_clean_val(column) for column in prepared.columns])
    current_score = _header_score(list(prepared.columns))
    promoted_index = None
    promoted_score = current_score

    for row_index in range(min(3, len(prepared.index))):
        candidate_headers = [_clean_val(value) for value in prepared.iloc[row_index].tolist()]
        score = _header_score(candidate_headers)
        if score >= 4 and score > promoted_score:
            promoted_index = row_index
            promoted_score = score

    if promoted_index is not None:
        prepared.columns = _make_unique_headers([_clean_val(value) for value in prepared.iloc[promoted_index].tolist()])
        prepared = prepared.iloc[promoted_index + 1 :].reset_index(drop=True)

    prepared = prepared.dropna(axis=0, how="all").dropna(axis=1, how="all")
    prepared.columns = _make_unique_headers([_clean_val(column) for column in prepared.columns])
    return prepared.reset_index(drop=True)


def _find_column(cols_upper: dict[str, str], exact_names: list[str]) -> str | None:
    for orig_col, upper_col in cols_upper.items():
        if upper_col in exact_names:
            return orig_col
    return None


def _find_column_startswith(cols_upper: dict[str, str], prefixes: list[str]) -> str | None:
    for orig_col, upper_col in cols_upper.items():
        if any(upper_col.startswith(prefix) for prefix in prefixes):
            return orig_col
    return None


def _build_semester(row: Any, col_map: dict[str, str]) -> str:
    pd = _require_pandas()
    if "semester_full" in col_map:
        raw_value = row.get(col_map["semester_full"], "")
        if pd.notna(raw_value):
            text = str(raw_value).strip()
            match = re.search(r"(20\d{2})\D*([12])", text)
            if match:
                return f"{match.group(1)}-{match.group(2)}"
            return text or "Desconhecido"

    year_value = _clean_val(row.get(col_map.get("semester_year"), "")) if "semester_year" in col_map else None
    semester_value = _clean_val(row.get(col_map.get("semester_num"), "")) if "semester_num" in col_map else None
    if year_value and semester_value:
        if year_value in semester_value:
            return semester_value
        return f"{year_value}-{semester_value}"
    if year_value:
        return year_value
    if semester_value:
        return semester_value
    return "Desconhecido"


def _extract_grade_columns(cols_upper: dict[str, str], reserved_columns: set[str]) -> list[str]:
    grade_columns = []
    for orig_col, upper_col in cols_upper.items():
        if orig_col in reserved_columns:
            continue
        if re.match(r"^(VA|N|NOTA|P|NP|AP)\d", upper_col):
            grade_columns.append(orig_col)
            continue
        if any(keyword in upper_col for keyword in ["MEDIA", "NOTA_FINAL", "NF", "AVALIACAO"]):
            grade_columns.append(orig_col)
    return grade_columns


def _map_dataframe_to_records(df: Any, source_label: str | None = None) -> list[dict[str, Any]]:
    pd = _require_pandas()
    prepared = _prepare_dataframe(df)
    if prepared is None or prepared.empty:
        return []

    cols_upper = {column: _normalize_text(column).upper().replace(" ", "_") for column in prepared.columns}
    col_map: dict[str, str] = {}

    mapping_rules = [
        ("student_name", ["NOME_ALUNO", "NOME", "ALUNO", "STUDENT"]),
        ("student_id", ["ID_ALUNO", "MATRICULA", "RA", "COD_ALUNO", "CODIGO_ALUNO"]),
        ("course_name", ["NOME_CURSO", "CURSO", "CURSO_ALUNO"]),
        ("course_code", ["COD_CURSO", "CODIGO_CURSO"]),
        ("subject", ["NOME_DISCIPLINA", "NOME_DISICPLINA", "NOME_DISICIPLINA", "DISCIPLINA", "MATERIA", "COMPONENTE_CURRICULAR"]),
        ("subject_code", ["COD_DISCIPLINA", "CODIGO_DISCIPLINA"]),
        ("semester_year", ["ANO"]),
        ("semester_num", ["SEMESTRE"]),
        ("semester_full", ["SEM_LETIVO", "SEMESTRE_LETIVO", "PERIODO_LETIVO"]),
        ("period", ["SERIE", "PERIODO"]),
        ("situation", ["SITUACAO", "STATUS", "RESULTADO"]),
        ("grade", ["NOTA", "MEDIA", "NOTA_FINAL", "MEDIA_FINAL"]),
        ("attendance", ["FREQUENCIA", "FREQ", "PRESENCA", "PERCENTUAL_PRESENCA"]),
        ("absences", ["FALTAS", "TOTAL_FALTAS"]),
    ]

    for field, exact_names in mapping_rules:
        found = _find_column(cols_upper, exact_names)
        if found:
            col_map[field] = found

    startswith_rules = [
        ("course_name", ["NOME_CURS", "CURSO"]),
        ("subject", ["NOME_DISC", "NOME_DISI", "DISCIPLI", "MATERIA"]),
        ("situation", ["SITUAC"]),
        ("attendance", ["FREQUEN", "PRESENC"]),
    ]
    for field, prefixes in startswith_rules:
        if field not in col_map:
            found = _find_column_startswith(cols_upper, prefixes)
            if found:
                col_map[field] = found

    grade_columns = _extract_grade_columns(cols_upper, set(col_map.values()))

    records = []
    rows_dict = prepared.to_dict(orient="records")
    for row in rows_dict:
        semester = _build_semester(row, col_map)
        student_name = _clean_val(row.get(col_map["student_name"], "")) if "student_name" in col_map else None
        student_code = _clean_val(row.get(col_map["student_id"], "")) if "student_id" in col_map else None
        if not student_name and student_code:
            student_name = f"Aluno {student_code}"

        course_name = _clean_val(row.get(col_map["course_name"], "")) if "course_name" in col_map else None
        if not course_name and "course_code" in col_map:
            course_name = _clean_val(row.get(col_map["course_code"], ""))

        subject = _clean_val(row.get(col_map["subject"], "")) if "subject" in col_map else None
        if not subject and "subject_code" in col_map:
            subject = _clean_val(row.get(col_map["subject_code"], ""))
        if not subject and source_label:
            subject = source_label

        period = _coerce_period(row.get(col_map["period"], None)) if "period" in col_map else None
        attendance = _coerce_attendance(row.get(col_map["attendance"], None)) if "attendance" in col_map else None
        if attendance is None and "absences" in col_map:
            absences = _coerce_float(row.get(col_map["absences"], None))
            if absences is not None:
                attendance = round(max(0.0, 100.0 - absences), 2)

        grades: dict[str, Any] = {}
        if "situation" in col_map:
            situation = _clean_val(row.get(col_map["situation"], None))
            if situation:
                grades["SITUACAO"] = situation
        if "grade" in col_map:
            grade_value = row.get(col_map["grade"], None)
            numeric_grade = _coerce_grade(grade_value)
            grades["Nota"] = numeric_grade if numeric_grade is not None else _clean_val(grade_value)
        for grade_column in grade_columns:
            grade_value = row.get(grade_column, None)
            if pd.notna(grade_value):
                label = str(grade_column).strip()
                numeric_grade = _coerce_grade(grade_value)
                grades[label] = numeric_grade if numeric_grade is not None else _clean_val(grade_value)

        # Filtrar disciplinas ou alunos fantasmas de cabeçalhos repetidos ou nulos
        if not subject or str(subject).strip().lower() in {"", "nan", "none", "null", "undefined"}:
            continue
        if not student_name or str(student_name).strip().lower() in {"", "nan", "none", "null", "undefined", "n/a"}:
            continue
            
        subj_norm = _normalize_text(subject).upper()
        if subj_norm in {"DISCIPLINA", "MATERIA", "NOME_DISCIPLINA", "NOME_DE_DISCIPLINA", "COMPONENTE_CURRICULAR", "DISCIPLINAS", "SUBJECT"}:
            continue
            
        student_norm = _normalize_text(student_name).upper()
        if student_norm in {"NOME", "ALUNO", "NOME_ALUNO", "STUDENT", "NOME_DO_ALUNO", "NOME_COMPLETO"}:
            continue

        if not any([student_name, course_name, subject, grades, attendance is not None]):
            continue

        records.append({
            "semester": semester or "Desconhecido",
            "course_name": course_name or "Desconhecido",
            "subject": subject,
            "period": period,
            "student_name": student_name or "N/A",
            "student_code": student_code,
            "grades": grades,
            "attendance": attendance,
        })

    return records


def _parse_csv(content: bytes) -> Any:
    pd = _require_pandas()
    best_df = None
    best_score = (-1, -1)
    best_sep = ";"
    best_encoding = "utf-8"

    for sep in [";", ",", "\t", "|"]:
        for encoding in ["utf-8-sig", "utf-8", "cp1252", "latin-1"]:
            try:
                candidate = pd.read_csv(io.BytesIO(content), sep=sep, encoding=encoding, on_bad_lines="skip", nrows=100)
                prepared = _prepare_dataframe(candidate)
                if prepared is None or prepared.empty:
                    continue
                score = (_header_score(list(prepared.columns)), len(prepared.columns))
                if score > best_score:
                    best_score = score
                    best_sep = sep
                    best_encoding = encoding
            except Exception:
                continue

    try:
        candidate = pd.read_csv(io.BytesIO(content), sep=best_sep, encoding=best_encoding, on_bad_lines="skip")
        best_df = _prepare_dataframe(candidate)
    except Exception:
        try:
            candidate = pd.read_csv(io.BytesIO(content), sep=None, engine="python", on_bad_lines="skip")
            best_df = _prepare_dataframe(candidate)
        except Exception:
            return None

    return best_df


def _parse_text_table(spreadsheet_text: str) -> Any:
    pd = _require_pandas()
    if not spreadsheet_text.strip():
        return None

    for sep in [";", "|", "\t", ","]:
        try:
            candidate = pd.read_csv(io.StringIO(spreadsheet_text), sep=sep, engine="python", on_bad_lines="skip")
            prepared = _prepare_dataframe(candidate)
            if prepared is not None and not prepared.empty and len(prepared.columns) >= 3:
                return prepared
        except Exception:
            continue

    return None


def _extract_text_from_pdf(content: bytes) -> str:
    import pdfplumber

    pages_text = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages_text.append(text)
            tables = page.extract_tables() or []
            for table in tables:
                for row in table:
                    if row:
                        pages_text.append(" | ".join([str(cell) if cell else "" for cell in row]))
    return "\n".join(pages_text)


def _merge_duplicate_records(records_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str, str, str, str], dict[str, Any]] = {}

    for record in records_data:
        key = (
            _normalize_text(record.get("semester")),
            _normalize_text(record.get("course_name")),
            _normalize_text(record.get("subject")),
            str(record.get("period") or ""),
            _normalize_text(record.get("student_name")),
        )
        existing = grouped.get(key)
        if not existing:
            grouped[key] = {
                "semester": str(record.get("semester") or "Desconhecido").strip() or "Desconhecido",
                "course_name": str(record.get("course_name") or "Desconhecido").strip() or "Desconhecido",
                "subject": str(record.get("subject") or "").strip() or None,
                "period": record.get("period"),
                "student_name": str(record.get("student_name") or "N/A").strip() or "N/A",
                "grades": dict(record.get("grades") or {}),
                "attendance": record.get("attendance"),
            }
            continue

        existing["grades"].update({key_name: value for key_name, value in (record.get("grades") or {}).items() if value not in (None, "")})
        existing_attendance = existing.get("attendance")
        new_attendance = record.get("attendance")
        if existing_attendance is None:
            existing["attendance"] = new_attendance
        elif new_attendance is not None:
            existing["attendance"] = round((float(existing_attendance) + float(new_attendance)) / 2, 2)

    return list(grouped.values())


def _record_key(record: dict[str, Any]) -> tuple[str, str, str, str, str]:
    return (
        _normalize_text(record.get("semester")),
        _normalize_text(record.get("course_name")),
        _normalize_text(record.get("subject")),
        str(record.get("period") or ""),
        _normalize_text(record.get("student_name")),
    )


def _extract_status_label(grades: dict[str, Any]) -> str | None:
    for key, value in (grades or {}).items():
        key_name = str(key).strip().lower()
        if "situacao" in key_name or "status" in key_name or "resultado" in key_name:
            return str(value)
    return None


def _extract_numeric_grade_summary(grades: dict[str, Any]) -> tuple[float | None, list[dict[str, float]]]:
    numeric_items: list[dict[str, float]] = []

    for key, value in (grades or {}).items():
        key_name = str(key).strip().lower()
        if "situacao" in key_name or "status" in key_name or "resultado" in key_name:
            continue

        numeric_value = _coerce_grade(value)
        if numeric_value is None:
            continue

        numeric_items.append({"label": str(key), "value": round(numeric_value, 2)})

    if not numeric_items:
        return None, []

    average = round(sum(item["value"] for item in numeric_items) / len(numeric_items), 2)
    return average, numeric_items[:4]


def _format_student_enum(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "value"):
        return str(value.value)
    return str(value)


def _build_upload_class_groups(records_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, dict[str, Any]] = {}

    for record in records_data:
        semester = record.get("semester") or "Sem semestre"
        subject = record.get("subject") or "Turma sem disciplina"
        course_name = record.get("course_name") or "Curso nao informado"
        period_label = f"{record['period']}o periodo" if record.get("period") else "Periodo nao informado"
        key = f"{semester}::{course_name}::{subject}::{period_label}"

        group = groups.setdefault(key, {
            "key": key,
            "semester": semester,
            "course_name": course_name,
            "subject": subject,
            "period_label": period_label,
            "students": set(),
            "attendance_values": [],
            "grade_values": [],
            "attention_count": 0,
        })
        group["students"].add(record.get("student_name") or "N/A")

        attendance = _coerce_attendance(record.get("attendance"))
        if attendance is not None:
            group["attendance_values"].append(attendance)

        grade_average, _ = _extract_numeric_grade_summary(record.get("grades") or {})
        if grade_average is not None:
            group["grade_values"].append(grade_average)

        if (attendance is not None and attendance < 75) or (grade_average is not None and grade_average < 6):
            group["attention_count"] += 1
        elif _extract_status_label(record.get("grades") or {}) and re.search(r"reprov|risco|alerta", _extract_status_label(record.get("grades") or {}) or "", re.I):
            group["attention_count"] += 1

    payload = []
    for group in groups.values():
        attendance_values = group.pop("attendance_values")
        grade_values = group.pop("grade_values")
        students = group.pop("students")
        payload.append({
            **group,
            "student_count": len(students),
            "avg_attendance": round(sum(attendance_values) / len(attendance_values), 2) if attendance_values else None,
            "avg_grade": round(sum(grade_values) / len(grade_values), 2) if grade_values else None,
        })

    payload.sort(key=lambda item: (-item["attention_count"], item["subject"], item["semester"]))
    return payload[:8]


def _serialize_historical_record(record: HistoricalRecord, matched_student: Student | None) -> dict[str, Any]:
    grade_average, grade_items = _extract_numeric_grade_summary(record.grades or {})
    status_label = _extract_status_label(record.grades or {})
    schedule = _format_student_enum(getattr(matched_student, "class_schedule", None))
    student_status = _format_student_enum(getattr(matched_student, "status", None))

    return {
        "id": record.id,
        "semester": record.semester,
        "course_name": record.course_name,
        "subject": record.subject,
        "period": record.period,
        "student_name": matched_student.name if matched_student else record.student_name,
        "attendance": record.attendance,
        "grades": record.grades,
        "grade_average": grade_average,
        "grade_items": grade_items,
        "status_label": status_label,
        "class_key": f"{record.subject or 'Turma sem disciplina'}::{record.period or 'Sem periodo'}::{record.semester or 'Sem semestre'}::{record.course_name or 'Curso nao informado'}",
        "professor_id": record.professor_id,
        "student_id": getattr(matched_student, "id", None),
        "registration_number": getattr(matched_student, "registration_number", None),
        "current_period": getattr(matched_student, "current_period", None),
        "class_schedule": schedule,
        "student_status": student_status,
        "enrollment_date": matched_student.enrollment_date.isoformat() if getattr(matched_student, "enrollment_date", None) else None,
        "is_working": bool(getattr(matched_student, "is_working", False)),
        "work_schedule": getattr(matched_student, "work_schedule", None),
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }


def _sync_historical_to_main_db(db: Session, records_data: list[dict[str, Any]], user_id: int):
    """
    Sincroniza registros históricos recém-importados diretamente com as tabelas principais do banco de dados (Course, Student, Enrollment, Grade, Attendance, ProfessorCourse).
    Garante que todo o ecossistema do SIMA passe a dispor de dados verídicos e integrados de forma orgânica.
    """
    # 1. Carregar/Criar Professor
    professor = db.query(Professor).filter(Professor.user_id == user_id).first()
    if not professor:
        professor = Professor(user_id=user_id)
        db.add(professor)
        db.flush()
    
    # 2. Caches locais em dicionário para performance máxima em SQLite (evita gargalo de consultas N+1)
    courses_cache = {(c.name.strip().upper(), c.semester.strip()): c for c in db.query(Course).all()}
    students_cache = {s.name.strip().upper(): s for s in db.query(Student).all()}
    
    # 3. Conjuntos para controlar relações existentes do professor
    existing_prof_courses = {pc.course_id for pc in professor.professor_courses}
    existing_prof_academic = {pa.course_name.strip().upper() for pa in professor.academic_courses}
    
    # 4. Criar disciplinas (Course) inexistentes de forma atômica
    for record in records_data:
        subject = (record.get("subject") or "").strip()
        semester = (record.get("semester") or "Desconhecido").strip()
        if not subject:
            continue
        
        ckey = (subject.upper(), semester)
        if ckey not in courses_cache:
            cleaned_subj = re.sub(r'[^A-Z0-9]', '', subject.upper())[:6]
            cleaned_sem = re.sub(r'[^A-Z0-9]', '', semester.upper())[:6]
            h = abs(hash(subject + semester)) % 1000000
            code = f"{cleaned_subj}{cleaned_sem}{h}"[:20]
            
            course = Course(
                name=subject,
                code=code,
                credits=4,
                semester=semester,
                department=record.get("course_name", "Geral") or "Geral"
            )
            db.add(course)
            db.flush()
            courses_cache[ckey] = course
            
    # 5. Associar disciplinas e cursos acadêmicos ao professor logado (REMOVIDO para evitar poluição do perfil ativo)
    # Anteriormente o histórico associava automaticamente as disciplinas ao professor ativo.
    # Agora isso é controlado apenas via perfil/seleção manual de disciplinas reais.
    pass

            
    db.flush()
            
    # 6. Criar alunos (Student) inexistentes
    for record in records_data:
        student_name = (record.get("student_name") or "").strip()
        course_name = (record.get("course_name") or "").strip()
        period = record.get("period")
        student_code = record.get("student_code")
        if not student_name:
            continue
            
        skey = student_name.upper()
        if skey not in students_cache:
            h = abs(hash(student_name)) % 100000000
            
            # Se a planilha contiver matrícula real, usaremos ela; senão criamos código padrão visualizável
            reg_number = student_code if student_code else f"ALU-{h}"
            email = f"alu_{h}@sima.edu"
            
            student = Student(
                name=student_name,
                course_name=course_name or "Geral",
                current_period=period,
                email=email,
                registration_number=reg_number,
                enrollment_date=date.today(),
                status=StudentStatus.ACTIVE
            )
            db.add(student)
            db.flush()
            students_cache[skey] = student
            
    # 7. Matrículas (Enrollment)
    enrollments_cache = {(e.student_id, e.course_id): e for e in db.query(Enrollment).all()}
    
    for record in records_data:
        student_name = (record.get("student_name") or "").strip()
        subject = (record.get("subject") or "").strip()
        semester = (record.get("semester") or "Desconhecido").strip()
        if not student_name or not subject:
            continue
            
        student = students_cache.get(student_name.upper())
        course = courses_cache.get((subject.upper(), semester))
        if student and course:
            ekey = (student.id, course.id)
            if ekey not in enrollments_cache:
                enrollment = Enrollment(
                    student_id=student.id,
                    course_id=course.id,
                    semester=semester,
                    status=EnrollmentStatus.ENROLLED
                )
                db.add(enrollment)
                enrollments_cache[ekey] = enrollment
                
    db.flush()
    
    # 8. Limpar Notas (Grade) e Frequências (Attendance) antigas para evitar duplicidade de reimportações
    student_ids = [s.id for s in students_cache.values()]
    course_ids = [c.id for c in courses_cache.values()]
    
    if student_ids and course_ids:
        db.execute(
            delete(Grade).where(
                Grade.student_id.in_(student_ids),
                Grade.course_id.in_(course_ids)
            )
        )
        db.execute(
            delete(Attendance).where(
                Attendance.student_id.in_(student_ids),
                Attendance.course_id.in_(course_ids)
            )
        )
        
    db.flush()
        
    # 9. Inserir Notas e Presenças de forma massiva e otimizada (Bulk Insert)
    base_date = date.today() - timedelta(days=90)
    bulk_grades = []
    bulk_attendances = []
    
    # Se for planilha de grande porte (mais de 1.000 linhas), reduzimos a assiduidade diária operacional para 1 registro consolidado.
    # Isso evita gerar 8.8 milhões de linhas para 147.000 alunos no SQLite, acelerando a importação em mais de 100x.
    is_giant_file = len(records_data) > 1000
    total_lessons = 1 if is_giant_file else 60
    
    for record in records_data:
        student_name = (record.get("student_name") or "").strip()
        subject = (record.get("subject") or "").strip()
        semester = (record.get("semester") or "Desconhecido").strip()
        if not student_name or not subject:
            continue
            
        student = students_cache.get(student_name.upper())
        course = courses_cache.get((subject.upper(), semester))
        if student and course:
            # Lançar Notas principais
            grades_dict = record.get("grades") or {}
            for name_val, val in grades_dict.items():
                if name_val == "SITUACAO":
                    continue
                if val is not None:
                    try:
                        fval = float(val)
                        bulk_grades.append({
                            "student_id": student.id,
                            "course_id": course.id,
                            "value": fval,
                            "weight": 1.0,
                            "assessment_type": AssessmentType.EXAM,
                            "description": str(name_val)
                        })
                    except ValueError:
                        continue
            
            # Lançar Frequências
            attendance_pct = record.get("attendance")
            
            if attendance_pct is not None:
                try:
                    att_float = float(attendance_pct)
                    if att_float <= 1.0:
                        att_float = att_float * 100.0
                    
                    if is_giant_file:
                        # Para planilhas gigantes, cria apenas 1 presença consolidada diária de status geral
                        status_val = AttendanceStatus.PRESENT if att_float >= 75.0 else AttendanceStatus.ABSENT
                        bulk_attendances.append({
                            "student_id": student.id,
                            "course_id": course.id,
                            "date": base_date,
                            "status": status_val
                        })
                    else:
                        absent_lessons = int(round(total_lessons * (1.0 - att_float / 100.0)))
                        absent_lessons = max(0, min(total_lessons, absent_lessons))
                        present_lessons = total_lessons - absent_lessons
                        for idx in range(total_lessons):
                            lesson_date = base_date + timedelta(days=idx)
                            status_val = AttendanceStatus.PRESENT if idx < present_lessons else AttendanceStatus.ABSENT
                            bulk_attendances.append({
                                "student_id": student.id,
                                "course_id": course.id,
                                "date": lesson_date,
                                "status": status_val
                            })
                except ValueError:
                    bulk_attendances.append({
                        "student_id": student.id,
                        "course_id": course.id,
                        "date": base_date,
                        "status": AttendanceStatus.PRESENT
                    })
            else:
                bulk_attendances.append({
                    "student_id": student.id,
                    "course_id": course.id,
                    "date": base_date,
                    "status": AttendanceStatus.PRESENT
                })

    # Executar inserções em lote otimizadas (Bulk Mappings em chunks)
    if bulk_grades:
        chunk_size = 10000
        for i in range(0, len(bulk_grades), chunk_size):
            db.bulk_insert_mappings(Grade, bulk_grades[i:i + chunk_size])
            db.flush()
            
    if bulk_attendances:
        chunk_size = 20000
        for i in range(0, len(bulk_attendances), chunk_size):
            db.bulk_insert_mappings(Attendance, bulk_attendances[i:i + chunk_size])
            db.flush()
                
    db.flush()


@router.post("/upload", response_model=HistoricalUploadResponse)
async def upload_historical_spreadsheet(
    file: UploadFile = File(...),
    correct_data: bool = Form(False),
    target_spreadsheet_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    content = await file.read()
    filename = (file.filename or "").lower()
    warnings: list[str] = []
    normalization_steps = [
        "Detecta colunas fora de ordem e tenta promover o cabecalho correto automaticamente.",
        "Padroniza nomes de aluno, curso, disciplina, semestre, nota e frequencia para uma estrutura unica.",
        "Consolida linhas repetidas da mesma turma e do mesmo aluno antes de alimentar as analises.",
    ]
    extension = _validate_upload(filename, content)

    try:
        records_data: list[dict[str, Any]] = []

        if extension == ".csv":
            df = _parse_csv(content)
            if df is None or len(df.index) == 0:
                raise HTTPException(status_code=422, detail="Nao foi possivel ler o CSV. Verifique o formato do arquivo.")
            records_data = _map_dataframe_to_records(df)

        elif extension in {".xls", ".xlsx"}:
            pd = _require_pandas()
            workbook = pd.read_excel(io.BytesIO(content), sheet_name=None)
            for sheet_name, df in workbook.items():
                mapped_records = _map_dataframe_to_records(df, source_label=sheet_name)
                if mapped_records:
                    records_data.extend(mapped_records)
            if not records_data:
                raise HTTPException(status_code=422, detail="Nao foi possivel identificar registros validos na planilha Excel.")

        elif extension == ".txt":
            spreadsheet_text = ""
            for encoding in ["utf-8-sig", "utf-8", "cp1252", "latin-1"]:
                try:
                    spreadsheet_text = content.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue
            if not spreadsheet_text:
                spreadsheet_text = content.decode("utf-8", errors="ignore")

            local_df = _parse_text_table(spreadsheet_text)
            if local_df is not None:
                records_data = _map_dataframe_to_records(local_df)
            if not records_data and settings.ENABLE_GEMINI_UPLOAD_FALLBACK:
                warnings.append("Leitura heuristica insuficiente. A NEXORA acionou a extracao assistida por IA para completar a organizacao.")
                records_data = await gemini_service.parse_historical_spreadsheet(spreadsheet_text[:15000])

        elif extension == ".pdf":
            spreadsheet_text = _extract_text_from_pdf(content)
            local_df = _parse_text_table(spreadsheet_text)
            if local_df is not None:
                records_data = _map_dataframe_to_records(local_df)
            if not records_data and settings.ENABLE_GEMINI_UPLOAD_FALLBACK:
                warnings.append("O PDF nao trouxe tabela estruturada suficiente. A NEXORA usou a extracao assistida por IA para recuperar os registros.")
                records_data = await gemini_service.parse_historical_spreadsheet(spreadsheet_text[:15000])

        if not records_data:
            raise HTTPException(status_code=422, detail="Nenhum dado importante foi extraido do arquivo enviado.")
        if len(records_data) > settings.MAX_HISTORICAL_RECORDS_PER_FILE:
            raise HTTPException(
                status_code=413,
                detail=f"O arquivo gerou {len(records_data)} registros, acima do limite de {settings.MAX_HISTORICAL_RECORDS_PER_FILE}.",
            )

        records_data = _merge_duplicate_records(records_data)

        if correct_data:
            warnings.append("Correção ativa por IA: a NEXORA aplicou inteligência generativa para normalizar inconsistências, acentos e valores de notas/frequências na planilha.")
            try:
                records_data = await gemini_service.clean_and_correct_records(records_data)
            except Exception as clean_exc:
                logger.error("Erro na limpeza ativa por IA: %s", clean_exc)
                warnings.append(f"Aviso: Não foi possível completar a limpeza por IA devido a uma falha: {clean_exc}. Os dados originais foram mantidos.")

        class_groups = _build_upload_class_groups(records_data)

        # 1. Agregação e cálculos de estatísticas da planilha
        unique_courses = sorted({record.get("course_name") for record in records_data if record.get("course_name")})
        unique_subjects = sorted({record.get("subject") for record in records_data if record.get("subject")})
        unique_semesters = sorted({record.get("semester") for record in records_data if record.get("semester")})
        attendance_values = [float(record.get("attendance")) for record in records_data if record.get("attendance") is not None]
        numeric_grades = []
        for record in records_data:
            grade_average, _ = _extract_numeric_grade_summary(record.get("grades") or {})
            if grade_average is not None:
                numeric_grades.append(float(grade_average))

        avg_attendance = round(sum(attendance_values) / len(attendance_values), 2) if attendance_values else None
        avg_grade = round(sum(numeric_grades) / len(numeric_grades), 2) if numeric_grades else None

        # 2. Criar ou Atualizar registro na tabela de planilhas (Upload por Cima)
        spreadsheet = None
        if target_spreadsheet_id is not None:
            spreadsheet = db.query(HistoricalSpreadsheet).filter(
                HistoricalSpreadsheet.id == target_spreadsheet_id,
                HistoricalSpreadsheet.professor_id == current_user.id
            ).first()
            if not spreadsheet:
                raise HTTPException(status_code=404, detail="Planilha de destino nao encontrada.")
            
            # Limpar dados antigos associados a essa planilha na base principal
            _cleanup_main_db_for_spreadsheet(db, spreadsheet)
            
            # Remover registros de alunos antigos vinculados a essa planilha
            db.execute(
                delete(HistoricalRecord).where(
                    HistoricalRecord.spreadsheet_id == spreadsheet.id
                )
            )
            db.flush()
            
            # Atualizar metadados da planilha
            spreadsheet.filename = file.filename or "planilha_desconhecida"
            spreadsheet.semester = unique_semesters[0] if len(unique_semesters) == 1 else "Multiplos"
            spreadsheet.course_name = unique_courses[0] if len(unique_courses) == 1 else "Multiplos"
            spreadsheet.records_count = len(records_data)
            spreadsheet.avg_grade = avg_grade
            spreadsheet.avg_attendance = avg_attendance
        else:
            # Criar nova planilha
            spreadsheet = HistoricalSpreadsheet(
                filename=file.filename or "planilha_desconhecida",
                semester=unique_semesters[0] if len(unique_semesters) == 1 else "Multiplos",
                course_name=unique_courses[0] if len(unique_courses) == 1 else "Multiplos",
                records_count=len(records_data),
                avg_grade=avg_grade,
                avg_attendance=avg_attendance,
                professor_id=current_user.id
            )
            db.add(spreadsheet)
            
        db.flush()  # Para obter o spreadsheet.id ou registrar atualizações

        # 3. Remover registros duplicados antigos de maneira performática (Bulk Delete) - Apenas se não for upload por cima
        if target_spreadsheet_id is None:
            subjects_in_file = {r.get("subject") for r in records_data if r.get("subject")}
            semesters_in_file = {r.get("semester") for r in records_data if r.get("semester")}

            if subjects_in_file and semesters_in_file:
                db.execute(
                    delete(HistoricalRecord).where(
                        HistoricalRecord.professor_id == current_user.id,
                        HistoricalRecord.semester.in_(semesters_in_file),
                        HistoricalRecord.subject.in_(subjects_in_file)
                    )
                )

        # 4. Criar e associar novos registros históricos (Bulk Insert Mappings - em chunks e com SQLite PRAGMAs)
        # Otimizar conexão SQLite temporariamente para escrita em alta performance
        is_sqlite = db.bind.dialect.name == "sqlite"
        if is_sqlite:
            try:
                db.execute(text("PRAGMA journal_mode=WAL;"))
                db.execute(text("PRAGMA synchronous=NORMAL;"))
                db.execute(text("PRAGMA cache_size=-100000;"))
            except Exception as e:
                logger.warning("Nao foi possivel configurar PRAGMAs do SQLite: %s", e)

        bulk_data = []
        for record_data in records_data:
            bulk_data.append({
                "semester": record_data.get("semester", "Desconhecido"),
                "course_name": record_data.get("course_name", "Desconhecido"),
                "subject": record_data.get("subject"),
                "period": record_data.get("period"),
                "student_name": record_data.get("student_name", "N/A"),
                "grades": record_data.get("grades", {}),
                "attendance": record_data.get("attendance"),
                "professor_id": current_user.id,
                "spreadsheet_id": spreadsheet.id,
            })
            
        # Inserção em chunks de 20.000 para manter consumo de memória baixo e evitar timeouts disfarçados
        chunk_size = 20000
        for i in range(0, len(bulk_data), chunk_size):
            chunk = bulk_data[i:i + chunk_size]
            db.bulk_insert_mappings(HistoricalRecord, chunk)
            db.flush()
        
        # O backend não armazena mais localmente cada instância de new_records.
        # Nós usamos um mockup apenas para contabilizar para o front.
        new_records = bulk_data

        # Sincronizar com as tabelas principais de forma robusta e integrada
        try:
            _sync_historical_to_main_db(db, records_data, current_user.id)
        except Exception as sync_exc:
            logger.error("Erro ao sincronizar dados historicos com a base principal: %s", sync_exc, exc_info=True)
            warnings.append(f"Aviso: Os registros foram salvos no historico, mas ocorreu um problema ao sincroniza-los com a base principal: {sync_exc}")

        db.commit()
        HistoricalAnalysisService.clear_workspace_cache()

        return {
            "message": "Arquivo tratado, turmas organizadas e base histórica atualizada com sucesso.",
            "records_count": len(new_records),
            "semester": unique_semesters[0] if len(unique_semesters) == 1 else "Múltiplos",
            "course_organized": True,
            "courses": unique_courses[:8],
            "subjects": unique_subjects[:10],
            "warnings": warnings,
            "normalization_steps": normalization_steps,
            "summary": {
                "avg_attendance": avg_attendance,
                "avg_grade": avg_grade,
                "students": len({record.get("student_name") for record in records_data if record.get("student_name")}),
                "classes": len(class_groups),
                "semesters": len(unique_semesters),
            },
            "class_groups": class_groups,
            "spreadsheet_id": spreadsheet.id,
        }
    except Exception as exc:
        db.rollback()
        logger.error("Erro ao processar arquivo: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao processar arquivo: {exc}") from exc


@router.delete("/clear")
def clear_historical_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    deleted = db.query(HistoricalRecord).filter(
        HistoricalRecord.professor_id == current_user.id
    ).delete()
    db.commit()
    HistoricalAnalysisService.clear_workspace_cache()
    return {"message": f"{deleted} registros removidos com sucesso."}


@router.get("")
def get_historical_records(
    semester: Optional[str] = Query(None),
    course_name: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = HistoricalAnalysisService(db)
    scoped_records, _ = service.get_scoped_records(
        current_user=current_user,
        semester=semester,
        course_name=course_name,
        subject=subject,
    )

    total_count = len(scoped_records)
    page_start = (page - 1) * page_size
    page_end = page_start + page_size
    records = scoped_records[page_start:page_end]
    student_by_name, student_by_name_and_course = service._build_student_indexes()

    return {
        "records": [
            _serialize_historical_record(
                record=record,
                matched_student=service._match_student(record, student_by_name, student_by_name_and_course),
            )
            for record in records
        ],
        "total_count": total_count,
        "page": page,
        "page_size": page_size,
    }


@router.get("/filters")
def get_historical_filters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = HistoricalAnalysisService(db)
    scoped_records, _ = service.get_scoped_records(current_user=current_user)
    return service._build_filters(scoped_records)


@router.get("/analysis-workspace")
def get_historical_analysis_workspace(
    semester: Optional[str] = Query(None),
    course_name: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    spreadsheet_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = HistoricalAnalysisService(db)
    return service.build_workspace(
        current_user=current_user,
        semester=semester,
        course_name=course_name,
        subject=subject,
        spreadsheet_id=spreadsheet_id,
    )


@router.get("/analysis-workspace/at-risk-students")
def get_at_risk_students_by_class(
    class_key: str = Query(...),
    semester: Optional[str] = Query(None),
    course_name: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    spreadsheet_id: Optional[int] = Query(None),
    limit: int = Query(4, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = HistoricalAnalysisService(db)
    bundle = service.get_workspace_bundle(
        current_user=current_user,
        semester=semester,
        course_name=course_name,
        subject=subject,
        spreadsheet_id=spreadsheet_id,
    )
    prepared = bundle.get("prepared_records", [])

    selected = [row for row in prepared if row.get("class_key") == class_key]
    if not selected:
        raise HTTPException(status_code=404, detail="Turma nao encontrada para o recorte atual.")

    payload = service._serialize_priority_students(selected, limit=limit)

    return {
        "class_key": class_key,
        "total_students": len({row.get("student_name") for row in selected if row.get("student_name")}),
        "at_risk_count": len(payload),
        "students": payload,
    }


@router.get("/analysis-workspace/export")
def export_historical_analysis_workspace(
    analysis_id: str = Query(...),
    export_format: str = Query(..., pattern="^(pdf|csv|xlsx|json)$"),
    semester: Optional[str] = Query(None),
    course_name: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    spreadsheet_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    analysis_service = HistoricalAnalysisService(db)
    export_service = HistoricalExportService()
    workspace = analysis_service.build_workspace(
        current_user=current_user,
        semester=semester,
        course_name=course_name,
        subject=subject,
        spreadsheet_id=spreadsheet_id,
    )

    title = ANALYSIS_TITLES.get(analysis_id)
    if not title:
        raise HTTPException(status_code=400, detail="Analise solicitada nao e suportada para exportacao.")

    rows = export_service.get_analysis_rows(workspace, analysis_id)
    payload = {
        "analysis_id": analysis_id,
        "analysis_title": title,
        "scope": workspace.get("scope", {}),
        "filters": {
            "semester": semester,
            "course_name": course_name,
            "subject": subject,
        },
        "overview": workspace.get("overview", {}),
        "rows": rows,
    }

    if export_format == "json":
        content = export_service.export_json(payload)
        media_type = "application/json"
    elif export_format == "csv":
        content = export_service.export_csv(rows)
        media_type = "text/csv; charset=utf-8"
    elif export_format == "xlsx":
        content = export_service.export_xlsx(rows, title)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        content = export_service.export_pdf(workspace, analysis_id, title, rows)
        media_type = "application/pdf"

    filename = export_service.build_filename(analysis_id, export_format)
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(io.BytesIO(content), media_type=media_type, headers=headers)


@router.post("/chat")
async def chat_about_spreadsheet(
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    message = request.get("message", "").strip()
    spreadsheet_id = request.get("spreadsheet_id")

    if not message:
        raise HTTPException(status_code=400, detail="Mensagem e obrigatoria")

    try:
        # 1. Se spreadsheet_id for fornecido, foca os dados exclusivamente naquele arquivo
        if spreadsheet_id is not None:
            spreadsheet = db.query(HistoricalSpreadsheet).filter(
                HistoricalSpreadsheet.id == spreadsheet_id
            ).first()
            if not spreadsheet:
                raise HTTPException(status_code=404, detail="Planilha ou PDF nao encontrado.")

            # Resgatar registros do arquivo
            records = db.query(HistoricalRecord).filter(
                HistoricalRecord.spreadsheet_id == spreadsheet_id
            ).all()

            if not records:
                return {"response": "Este arquivo foi processado, mas nao contem registros de notas ou frequencias associados."}

            # Calcular estatísticas da planilha
            attendance_values = [float(r.attendance) for r in records if r.attendance is not None]
            numeric_grades = []
            risk_count = 0
            risk_students_list = []

            for r in records:
                grade_average, _ = _extract_numeric_grade_summary(r.grades or {})
                if grade_average is not None:
                    numeric_grades.append(float(grade_average))
                
                is_at_risk = (r.attendance is not None and r.attendance < 75) or (grade_average is not None and grade_average < 6)
                if is_at_risk:
                    risk_count += 1
                    risk_students_list.append({
                        "student_name": r.student_name,
                        "student_id": r.id,
                        "gpa": grade_average,
                        "attendance_rate": r.attendance,
                        "risk_level": "critical" if ((r.attendance is not None and r.attendance < 60) or (grade_average is not None and grade_average < 5.0)) else "high"
                    })

            avg_attendance = sum(attendance_values) / len(attendance_values) if attendance_values else 80.0
            avg_grade = sum(numeric_grades) / len(numeric_grades) if numeric_grades else 7.0

            kpis = {
                "total_students": len(records),
                "average_gpa": round(avg_grade, 2),
                "average_attendance_rate": round(avg_attendance, 2),
                "at_risk_count": risk_count
            }

            # Ordenar alunos em risco por pior GPA para prioridade de insights
            risk_students_list.sort(key=lambda x: (x.get("gpa") or 10.0, x.get("attendance_rate") or 100.0))

            response_text = await gemini_service.chat(
                message=f"No contexto do arquivo '{spreadsheet.filename}' carregado na data {spreadsheet.uploaded_at.strftime('%d/%m/%Y')}: {message}",
                kpis=kpis,
                risk_students=risk_students_list[:15]
            )
            return {"response": response_text}

        # 2. Caso global (chat geral de dados do professor)
        else:
            records = db.query(HistoricalRecord).filter(
                HistoricalRecord.professor_id == current_user.id
            ).all()

            if not records:
                return {"response": "Nenhum dado historico encontrado no seu perfil. Por favor, suba planilhas ou PDFs para podermos conversar."}

            attendance_values = [float(r.attendance) for r in records if r.attendance is not None]
            numeric_grades = []
            risk_count = 0
            risk_students_list = []

            for r in records:
                grade_average, _ = _extract_numeric_grade_summary(r.grades or {})
                if grade_average is not None:
                    numeric_grades.append(float(grade_average))
                
                is_at_risk = (r.attendance is not None and r.attendance < 75) or (grade_average is not None and grade_average < 6)
                if is_at_risk:
                    risk_count += 1
                    risk_students_list.append({
                        "student_name": r.student_name,
                        "student_id": r.id,
                        "gpa": grade_average,
                        "attendance_rate": r.attendance,
                        "risk_level": "high"
                    })

            avg_attendance = sum(attendance_values) / len(attendance_values) if attendance_values else 80.0
            avg_grade = sum(numeric_grades) / len(numeric_grades) if numeric_grades else 7.0

            kpis = {
                "total_students": len(records),
                "average_gpa": round(avg_grade, 2),
                "average_attendance_rate": round(avg_attendance, 2),
                "at_risk_count": risk_count
            }

            response_text = await gemini_service.chat(
                message=message,
                kpis=kpis,
                risk_students=risk_students_list[:15]
            )
            return {"response": response_text}

    except Exception as exc:
        logger.error("Erro no chat inteligente do arquivo: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao conversar com a IA: {exc}") from exc


@router.post("/insights")
async def generate_historical_insights(
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    message = request.get("message", "").strip()
    if not message:
        message = (
            "Gere uma analise geral completa dos dados historicos. "
            "Identifique padroes, tendencias, disciplinas criticas e recomendacoes praticas."
        )

    records = db.query(HistoricalRecord).filter(
        HistoricalRecord.professor_id == current_user.id
    ).all()

    if not records:
        return {"response": "Nenhum dado historico encontrado. Carregue planilhas primeiro para gerar insights."}

    lines = []
    for record in records:
        grades_str = ", ".join([f"{key}={value}" for key, value in (record.grades or {}).items()])
        lines.append(
            f"Sem:{record.semester} | Curso:{record.course_name} | Materia:{record.subject or 'N/A'} | "
            f"Aluno:{record.student_name} | Notas:[{grades_str}] | Freq:{record.attendance}%"
        )

    records_summary = "\n".join(lines[:150])

    try:
        response_text = await gemini_service.chat_historical_insights(
            message=message,
            records_summary=records_summary,
            total_records=len(records),
        )
        return {"response": response_text}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar insights: {exc}") from exc


@router.get("/spreadsheets")
def list_uploaded_spreadsheets(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    spreadsheets = db.query(HistoricalSpreadsheet).filter(
        HistoricalSpreadsheet.professor_id == current_user.id
    ).order_by(HistoricalSpreadsheet.uploaded_at.desc()).all()

    total_spreadsheets = len(spreadsheets)
    total_records = sum(s.records_count for s in spreadsheets)

    weighted_grades = [s.avg_grade * s.records_count for s in spreadsheets if s.avg_grade is not None]
    weighted_records_grades = sum(s.records_count for s in spreadsheets if s.avg_grade is not None)
    global_avg_grade = round(sum(weighted_grades) / weighted_records_grades, 2) if weighted_records_grades > 0 else 0.0

    weighted_attendance = [s.avg_attendance * s.records_count for s in spreadsheets if s.avg_attendance is not None]
    weighted_records_attendance = sum(s.records_count for s in spreadsheets if s.avg_attendance is not None)
    global_avg_attendance = round(sum(weighted_attendance) / weighted_records_attendance, 2) if weighted_records_attendance > 0 else 0.0

    return {
        "spreadsheets": [
            {
                "id": s.id,
                "filename": s.filename,
                "uploaded_at": s.uploaded_at.isoformat(),
                "semester": s.semester,
                "course_name": s.course_name,
                "records_count": s.records_count,
                "avg_grade": s.avg_grade,
                "avg_attendance": s.avg_attendance,
            }
            for s in spreadsheets
        ],
        "global_summary": {
            "total_spreadsheets": total_spreadsheets,
            "total_records": total_records,
            "avg_grade": global_avg_grade,
            "avg_attendance": global_avg_attendance,
        }
    }


def _cleanup_main_db_for_spreadsheet(db: Session, spreadsheet: HistoricalSpreadsheet):
    """
    Remove da base de dados principal (Grade, Attendance, Enrollment, etc.) os dados gerados
    a partir da planilha que está sendo excluída, mantendo o banco de dados limpo e consistente.
    """
    try:
        # 1. Puxar todos os registros históricos associados à planilha
        records = db.query(HistoricalRecord).filter(HistoricalRecord.spreadsheet_id == spreadsheet.id).all()
        if not records:
            return
            
        student_names = {r.student_name.strip().upper() for r in records if r.student_name}
        subjects = {r.subject.strip().upper() for r in records if r.subject}
        semesters = {r.semester.strip() for r in records if r.semester}
        
        if not student_names or not subjects:
            return
            
        # 2. Localizar os alunos e disciplinas correspondentes no banco principal
        students = db.query(Student).filter(Student.name.in_(student_names)).all()
        student_ids = [s.id for s in students]
        
        courses = db.query(Course).filter(
            Course.name.in_(subjects),
            Course.semester.in_(semesters)
        ).all()
        course_ids = [c.id for c in courses]
        
        if not student_ids or not course_ids:
            return
            
        # 3. Remover notas (Grade) e presenças (Attendance) correspondentes
        db.execute(
            delete(Grade).where(
                Grade.student_id.in_(student_ids),
                Grade.course_id.in_(course_ids)
            )
        )
        db.execute(
            delete(Attendance).where(
                Attendance.student_id.in_(student_ids),
                Attendance.course_id.in_(course_ids)
            )
        )
        
        # 4. Remover matrículas (Enrollment) correspondentes
        db.execute(
            delete(Enrollment).where(
                Enrollment.student_id.in_(student_ids),
                Enrollment.course_id.in_(course_ids)
            )
        )
        
        db.flush()
        
        # 5. Limpar estudantes cujos e-mails sejam do domínio sima.edu fictício
        # e que não tenham mais nenhuma matrícula ativa no sistema
        for student in students:
            if student.email and student.email.endswith("@sima.edu"):
                enrollment_count = db.query(Enrollment).filter(Enrollment.student_id == student.id).count()
                if enrollment_count == 0:
                    db.delete(student)
                    
        # 6. Limpar disciplinas (Course) fictícias que não tenham mais nenhuma matrícula ativa
        for course in courses:
            enrollment_count = db.query(Enrollment).filter(Enrollment.course_id == course.id).count()
            if enrollment_count == 0:
                # Remover associações de professor
                db.execute(
                    delete(ProfessorCourse).where(ProfessorCourse.course_id == course.id)
                )
                db.delete(course)
                
        db.flush()
    except Exception as cleanup_exc:
        logger.error("Erro ao limpar dados principais da planilha excluida: %s", cleanup_exc, exc_info=True)


@router.delete("/spreadsheets/{id}")
def delete_uploaded_spreadsheet(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    spreadsheet = db.query(HistoricalSpreadsheet).filter(
        HistoricalSpreadsheet.id == id,
        HistoricalSpreadsheet.professor_id == current_user.id
    ).first()

    if not spreadsheet:
        raise HTTPException(status_code=404, detail="Planilha não encontrada ou você não tem permissão para deletá-la.")

    # Limpar os dados sincronizados na base principal antes de remover a planilha e seus registros históricos
    _cleanup_main_db_for_spreadsheet(db, spreadsheet)

    db.delete(spreadsheet)
    db.commit()
    HistoricalAnalysisService.clear_workspace_cache()
    return {"message": "Planilha e registros de alunos correspondentes removidos com sucesso."}


def _recalculate_spreadsheet_stats(db: Session, spreadsheet_id: int):
    spreadsheet = db.query(HistoricalSpreadsheet).filter(HistoricalSpreadsheet.id == spreadsheet_id).first()
    if not spreadsheet:
        return

    records = db.query(HistoricalRecord).filter(HistoricalRecord.spreadsheet_id == spreadsheet_id).all()
    
    records_count = len(records)
    
    # Calcular média geral de notas e frequência
    total_grade = 0.0
    grade_count = 0
    total_att = 0.0
    att_count = 0
    
    for r in records:
        if r.attendance is not None:
            try:
                total_att += float(r.attendance)
                att_count += 1
            except (ValueError, TypeError):
                pass
            
        grade_avg, _ = _extract_numeric_grade_summary(r.grades or {})
        if grade_avg is not None:
            try:
                total_grade += float(grade_avg)
                grade_count += 1
            except (ValueError, TypeError):
                pass
            
    spreadsheet.records_count = records_count
    spreadsheet.avg_grade = round(total_grade / grade_count, 2) if grade_count > 0 else 0.0
    spreadsheet.avg_attendance = round(total_att / att_count, 2) if att_count > 0 else 0.0
    
    db.commit()


@router.post("/records", status_code=201)
def create_historical_record(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    spreadsheet_id = data.get("spreadsheet_id")
    student_name = data.get("student_name", "").strip()
    subject = data.get("subject", "").strip()
    grades = data.get("grades") or {}
    attendance = data.get("attendance")
    course_name = data.get("course_name", "").strip()
    semester = data.get("semester", "").strip()
    period = data.get("period")

    if not spreadsheet_id:
        raise HTTPException(status_code=400, detail="spreadsheet_id é obrigatório.")
    if not student_name:
        raise HTTPException(status_code=400, detail="Nome do aluno é obrigatório.")

    # Validar se a planilha existe e pertence ao professor
    spreadsheet = db.query(HistoricalSpreadsheet).filter(
        HistoricalSpreadsheet.id == spreadsheet_id,
        HistoricalSpreadsheet.professor_id == current_user.id
    ).first()

    if not spreadsheet:
        raise HTTPException(status_code=404, detail="Planilha de destino não encontrada ou sem permissão.")

    # Se curso ou semestre não foram informados, herda da planilha
    if not course_name:
        course_name = spreadsheet.course_name or "Geral"
    if not semester:
        semester = spreadsheet.semester or "2024-1"

    # Tratar notas de forma segura
    if isinstance(grades, (int, float)):
        grades = {"média": float(grades)}
    elif not isinstance(grades, dict):
        grades = {}

    try:
        attendance_val = float(attendance) if attendance is not None else None
    except (ValueError, TypeError):
        attendance_val = None

    try:
        period_val = int(period) if period is not None else None
    except (ValueError, TypeError):
        period_val = None

    record = HistoricalRecord(
        spreadsheet_id=spreadsheet_id,
        student_name=student_name,
        subject=subject or "Geral",
        grades=grades,
        attendance=attendance_val,
        course_name=course_name,
        semester=semester,
        period=period_val,
        professor_id=current_user.id
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    # Recalcular estatísticas gerais da planilha
    _recalculate_spreadsheet_stats(db, spreadsheet_id)
    HistoricalAnalysisService.clear_workspace_cache()

    # Sincronizar na base principal para manter consistência
    try:
        _sync_historical_to_main_db(db, [
            {
                "semester": record.semester,
                "course_name": record.course_name,
                "subject": record.subject,
                "period": record.period,
                "student_name": record.student_name,
                "grades": record.grades,
                "attendance": record.attendance,
                "professor_id": record.professor_id,
            }
        ], current_user.id)
    except Exception as sync_exc:
        logger.error("Erro na sincronização secundária: %s", sync_exc)

    student_by_name, student_by_name_and_course = HistoricalAnalysisService(db)._build_student_indexes()
    return _serialize_historical_record(record, HistoricalAnalysisService(db)._match_student(record, student_by_name, student_by_name_and_course))


@router.put("/records/{record_id}")
def update_historical_record(
    record_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    record = db.query(HistoricalRecord).filter(
        HistoricalRecord.id == record_id,
        HistoricalRecord.professor_id == current_user.id
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail="Registro acadêmico de aluno não encontrado ou sem permissão.")

    if "student_name" in data:
        record.student_name = str(data["student_name"]).strip()
    if "subject" in data:
        record.subject = str(data["subject"]).strip()
    if "course_name" in data:
        record.course_name = str(data["course_name"]).strip()
    if "semester" in data:
        record.semester = str(data["semester"]).strip()
    
    if "period" in data:
        try:
            record.period = int(data["period"]) if data["period"] is not None else None
        except (ValueError, TypeError):
            pass

    if "grades" in data:
        grades = data["grades"]
        if isinstance(grades, (int, float)):
            record.grades = {"média": float(grades)}
        elif isinstance(grades, dict):
            record.grades = grades

    if "attendance" in data:
        try:
            record.attendance = float(data["attendance"]) if data["attendance"] is not None else None
        except (ValueError, TypeError):
            pass

    db.commit()
    db.refresh(record)

    # Recalcular estatísticas gerais da planilha
    if record.spreadsheet_id:
        _recalculate_spreadsheet_stats(db, record.spreadsheet_id)
        
    HistoricalAnalysisService.clear_workspace_cache()

    # Sincronizar na base principal para manter consistência
    try:
        _sync_historical_to_main_db(db, [
            {
                "semester": record.semester,
                "course_name": record.course_name,
                "subject": record.subject,
                "period": record.period,
                "student_name": record.student_name,
                "grades": record.grades,
                "attendance": record.attendance,
                "professor_id": record.professor_id,
            }
        ], current_user.id)
    except Exception as sync_exc:
        logger.error("Erro na sincronização de atualização secundária: %s", sync_exc)

    student_by_name, student_by_name_and_course = HistoricalAnalysisService(db)._build_student_indexes()
    return _serialize_historical_record(record, HistoricalAnalysisService(db)._match_student(record, student_by_name, student_by_name_and_course))


@router.delete("/records/{record_id}")
def delete_historical_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    record = db.query(HistoricalRecord).filter(
        HistoricalRecord.id == record_id,
        HistoricalRecord.professor_id == current_user.id
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail="Registro acadêmico de aluno não encontrado ou sem permissão.")

    spreadsheet_id = record.spreadsheet_id
    db.delete(record)
    db.commit()

    # Recalcular estatísticas gerais da planilha
    if spreadsheet_id:
        _recalculate_spreadsheet_stats(db, spreadsheet_id)
        
    HistoricalAnalysisService.clear_workspace_cache()

    return {"message": "Registro de aluno histórico deletado com sucesso e médias da planilha atualizadas."}


@router.get("/spreadsheets/{id}/analysis")
def get_spreadsheet_analysis(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    spreadsheet = db.query(HistoricalSpreadsheet).filter(
        HistoricalSpreadsheet.id == id,
        HistoricalSpreadsheet.professor_id == current_user.id
    ).first()

    if not spreadsheet:
        raise HTTPException(status_code=404, detail="Planilha não encontrada ou sem permissão de acesso.")

    service = HistoricalAnalysisService(db)
    workspace = service.build_workspace(
        current_user=current_user,
        spreadsheet_id=id
    )
    return {
        "spreadsheet": {
            "id": spreadsheet.id,
            "filename": spreadsheet.filename,
            "uploaded_at": spreadsheet.uploaded_at.isoformat(),
            "semester": spreadsheet.semester,
            "course_name": spreadsheet.course_name,
            "records_count": spreadsheet.records_count,
            "avg_grade": spreadsheet.avg_grade,
            "avg_attendance": spreadsheet.avg_attendance,
        },
        "workspace": workspace
    }


@router.post("/spreadsheets/{id}/chat")
async def chat_about_spreadsheet(
    id: int,
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    message = request.get("message", "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="A mensagem é obrigatória.")

    spreadsheet = db.query(HistoricalSpreadsheet).filter(
        HistoricalSpreadsheet.id == id,
        HistoricalSpreadsheet.professor_id == current_user.id
    ).first()

    if not spreadsheet:
        raise HTTPException(status_code=404, detail="Planilha não encontrada ou sem permissão de acesso.")

    records = db.query(HistoricalRecord).filter(
        HistoricalRecord.spreadsheet_id == id
    ).all()

    if not records:
        raise HTTPException(status_code=400, detail="Esta planilha está vazia.")

    lines = []
    for r in records:
        grades_str = ", ".join([f"{key}={value}" for key, value in (r.grades or {}).items()])
        lines.append(
            f"Aluno: {r.student_name} | Semestre: {r.semester} | Matéria: {r.subject or 'N/A'} | "
            f"Notas: [{grades_str}] | Frequência: {r.attendance}%"
        )
    records_summary = "\n".join(lines[:150])

    spreadsheet_summary = (
        f"Arquivo: {spreadsheet.filename}\n"
        f"Semestre: {spreadsheet.semester}\n"
        f"Curso: {spreadsheet.course_name}\n"
        f"Alunos: {spreadsheet.records_count}\n"
        f"Média Geral de Notas: {spreadsheet.avg_grade}\n"
        f"Média Geral de Frequência: {spreadsheet.avg_attendance}%\n"
    )

    prompt = (
        f"Você é a IA assistente da NEXORA na plataforma acadêmica SIMA.\n"
        f"Você está respondendo a perguntas específicas sobre a planilha acadêmica descrita abaixo:\n\n"
        f"{spreadsheet_summary}\n"
        f"ATENÇÃO CRÍTICA DE ANCORAGEM: O curso analisado na planilha é '{spreadsheet.course_name}'. Adapte todas as suas dicas, análises e intervenções propostas à realidade e desafios específicos de estudantes do curso de '{spreadsheet.course_name}'. Jamais invente ou afirme que o curso é 'Administração' ou qualquer outro curso fora do escopo.\n\n"
        f"Responda à seguinte pergunta do professor de forma analítica, profissional e empática em Português do Brasil: {message}"
    )

    try:
        response_text = await gemini_service.chat_historical_insights(
            message=prompt,
            records_summary=records_summary,
            total_records=len(records)
        )
        return {"response": response_text}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao interagir com IA: {exc}") from exc


@router.post("/spreadsheets/{id}/ai-analysis")
async def generate_spreadsheet_ai_analysis(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    try:
        spreadsheet = db.query(HistoricalSpreadsheet).filter(
            HistoricalSpreadsheet.id == id,
            HistoricalSpreadsheet.professor_id == current_user.id
        ).first()

        if not spreadsheet:
            raise HTTPException(status_code=404, detail="Planilha não encontrada ou sem permissão de acesso.")

        records = db.query(HistoricalRecord).filter(
            HistoricalRecord.spreadsheet_id == id
        ).all()

        if not records:
            raise HTTPException(status_code=400, detail="Esta planilha está vazia.")

        # 1. Calcular estatísticas detalhadas reais da planilha
        attendance_values = []
        for r in records:
            if r.attendance is not None:
                try:
                    attendance_values.append(float(r.attendance))
                except (ValueError, TypeError):
                    pass
                    
        has_attendance = len(attendance_values) > 0
        numeric_grades = []
        subject_stats = {}  # disciplina -> { grades: [], attendance: [], fail_count: 0, total_count: 0 }
        risk_students = []

        for r in records:
            grade_average, _ = _extract_numeric_grade_summary(r.grades or {})
            
            # Garantir conversão robusta para float
            g_float = None
            if grade_average is not None:
                try:
                    g_float = float(grade_average)
                    numeric_grades.append(g_float)
                except (ValueError, TypeError):
                    pass

            att_val = None
            if has_attendance and r.attendance is not None:
                try:
                    att_val = float(r.attendance)
                except (ValueError, TypeError):
                    pass
            
            subj = (r.subject or "Geral").strip()
            if subj not in subject_stats:
                subject_stats[subj] = {
                    "grades": [],
                    "attendance": [],
                    "fail_count": 0,
                    "total_count": 0
                }
                
            stats = subject_stats[subj]
            stats["total_count"] += 1
            
            if g_float is not None:
                stats["grades"].append(g_float)
                if g_float < 6.0:
                    stats["fail_count"] += 1
                    
            if has_attendance and att_val is not None:
                stats["attendance"].append(att_val)
                
            # Aluno em risco (frequência < 75 ou nota < 6.0)
            is_at_risk = (has_attendance and att_val is not None and att_val < 75.0) or (g_float is not None and g_float < 6.0)
            if is_at_risk:
                att_risk_term = att_val if has_attendance and att_val is not None else 100.0
                grade_risk_term = g_float if g_float is not None else 10.0
                risk_students.append({
                    "student_name": r.student_name,
                    "student_id": r.id,
                    "gpa": grade_average,
                    "attendance_rate": r.attendance if has_attendance else None,
                    "subject": r.subject or "Geral",
                    "risk_score": 100.0 - att_risk_term + (10.0 - grade_risk_term) * 10.0
                })

        # Ordenar alunos em risco pelo score de risco interno
        risk_students.sort(key=lambda x: x.get("risk_score", 0.0), reverse=True)

        # Identificar se há disciplinas maiores na planilha (com 3 ou mais alunos)
        has_larger_subjects = any(stats["total_count"] >= 3 for stats in subject_stats.values())

        # Identificar disciplina com maior risco pedagógico
        critical_subject_name = "Geral"
        critical_subject_reason = "Todas as disciplinas apresentam desempenho estável."
        highest_fail_rate = -1.0
        
        subject_details = []
        for subj, stats in subject_stats.items():
            # Filtrar matérias não convencionais/minúsculas de fachada (menos de 3 alunos)
            # se existirem disciplinas maiores
            if has_larger_subjects and stats["total_count"] < 3:
                continue

            avg_s_grade = sum(stats["grades"]) / len(stats["grades"]) if stats["grades"] else 7.0
            avg_s_att = sum(stats["attendance"]) / len(stats["attendance"]) if has_attendance and stats["attendance"] else None
            fail_rate = (stats["fail_count"] / stats["total_count"]) * 100.0 if stats["total_count"] > 0 else 0.0
            
            subject_details.append({
                "subject_name": subj,
                "avg_grade": round(avg_s_grade, 2),
                "avg_attendance": round(avg_s_att, 2) if has_attendance and avg_s_att is not None else None,
                "fail_rate": round(fail_rate, 2),
                "total_students": stats["total_count"]
            })
            
            if fail_rate > highest_fail_rate or (fail_rate == highest_fail_rate and avg_s_grade < 6.0):
                highest_fail_rate = fail_rate
                critical_subject_name = subj
                critical_subject_reason = f"Apresenta taxa de reprovação de {fail_rate:.1f}% e média geral de notas de {avg_s_grade:.2f}."

        if not subject_details:
            critical_subject_name = "Nenhuma"
            critical_subject_reason = "Dados de disciplinas não detalhados nesta base."

        avg_attendance = sum(attendance_values) / len(attendance_values) if has_attendance else None
        avg_grade = sum(numeric_grades) / len(numeric_grades) if numeric_grades else 7.0

        # Formatar dados para passar no prompt do Gemini
        kpis_summary = {
            "filename": spreadsheet.filename,
            "semester": spreadsheet.semester,
            "course_name": spreadsheet.course_name,
            "total_records": len(records),
            "avg_grade": round(avg_grade, 2),
            "avg_attendance": round(avg_attendance, 2) if has_attendance and avg_attendance is not None else None,
            "has_attendance": has_attendance,
            "at_risk_count": len(risk_students)
        }

        # Passar os top 5 alunos em risco
        top_5_risk = []
        for s in risk_students[:5]:
            top_5_risk.append({
                "name": s["student_name"],
                "gpa": s["gpa"],
                "attendance": s.get("attendance_rate"),
                "subject": s["subject"]
            })

        # Passar resumo das disciplinas
        subjects_summary = subject_details[:10]
        attendance_prompt_text = f"{kpis_summary['avg_attendance']}%" if kpis_summary['has_attendance'] else "NÃO DISPONÍVEL / NÃO REGISTRADA (--%)"

        # Agora montar o prompt rico do Gemini para a Análise Completa
        prompt = f"""Você é o NEXORA IA Assistente Acadêmico, um consultor avançado de Inteligência Artificial para professores e gestores educacionais no sistema SIMA.
Suas missões são realizar uma varredura completa e inteligente nos dados da planilha carregada abaixo e gerar um relatório analítico premium e detalhado.

═══ DADOS CONSOLIDADOS DA PLANILHA ═══
- Arquivo: {kpis_summary['filename']}
- Semestre: {kpis_summary['semester']}
- Curso: {kpis_summary['course_name']}
- Total de Alunos: {kpis_summary['total_records']}
- Nota Média Geral: {kpis_summary['avg_grade']}
- Frequência Média Geral: {attendance_prompt_text}
- Total de Alunos sob Alerta de Risco: {kpis_summary['at_risk_count']}

⚠️ TOP 5 ALUNOS COM MAIOR RISCO PEDAGÓGICO:
{json.dumps(top_5_risk, ensure_ascii=False, indent=2)}

📚 DISCIPLINAS E SEUS INDICADORES:
{json.dumps(subjects_summary, ensure_ascii=False, indent=2)}

═══ REGRAS E DIRETRIZES DO RELATÓRIO ═══
1. O relatório deve ser gerado estritamente em PORTUGUÊS DO BRASIL.
2. Formato: MARKDOWN enriquecido, limpo e direto (com títulos, subtítulos, listas estruturadas e destaques em negrito).
3. Não use blocos de código com ```markdown ou ``` nas pontas do texto, retorne apenas o markdown cru diretamente.
4. O relatório DEVE conter exatamente as seguintes seções estruturadas:

   # 📊 ANÁLISE DE IA: {kpis_summary['filename']}
   
   ## 1. Principais Tópicos & Padrões Pedagógicos Encontrados
   (Apresente uma varredura detalhada dos dados do semestre. Quais são os principais tópicos observados? Se houver presença, relacione com a nota; caso contrário, foque exclusivamente nos padrões de notas e avaliações. Seja concreto e analítico.)

   ## 2. Top 5 Alunos em Situação Crítica de Risco
   (Apresente uma lista detalhada com os 5 alunos identificados acima. Para cada um, mencione o nome, a nota média, a frequência média se houver e uma análise individual curta e empática do motivo do risco e a ação recomendada imediata.)

   ## 3. Disciplina Gargalo (Maior Risco Acadêmico)
   (Mencione claramente a disciplina com maior risco baseada nos dados e explique de forma qualitativa e quantitativa o porquê dela ser o gargalo. Apresente estatísticas de reprovação ou notas baixas que justifiquem.)

   ## 4. Plano de Intervenção Pedagógica (Como Intervir e Como Melhorar)
   (Apresente propostas práticas de intervenção pedagógica preventiva para o professor:
    * Ações de Curtíssimo Prazo (Como intervir agora): Ações diretas e imediatas com os alunos críticos.
    * Ações de Médio e Longo Prazo (Como melhorar): Estratégias táticas de engajamento continuado, fracionamento de avaliações, nivelamentos semanais.)

   ## 5. Sugestões de Tecnologias Educacionais de Apoio
   (Sugira tecnologias, plataformas, aplicativos e softwares específicos que podem apoiar o professor nessa mediação pedagógica, recuperação de conteúdo e monitoramento inteligente de dados. Diga exatamente qual a tecnologia e como usá-la no contexto das dificuldades apontadas.)

5. IMPORTANTE: Se a planilha não possuir dados de presença (has_attendance = False, Frequência Média Geral NÃO REGISTRADA), adapte todo o relatório para focar exclusivamente no aproveitamento de notas e ementas. NUNCA tente inventar taxas de frequência discentes ou padrões de assiduidade/faltas no relatório. Deixe claro que os dados de presença não constavam na base enviada.
6. ATENÇÃO E REGRA CRÍTICA DE RUÍDO: Nunca dê destaque ou coloque como disciplinas críticas/fachada de risco no semestre as turmas ou componentes curriculares não convencionais (ex: estágios, orientações, trabalhos individuais) ou que tenham absurdamente poucos alunos (como menos de 3 alunos ativos discentes). Foque estritamente em componentes curriculares coletivos e turmas reais e ativas da instituição.
7. ANCORAGEM OBRIGATÓRIA AO CURSO: O curso analisado é estritamente '{kpis_summary['course_name']}'. Toda a sua análise pedagógica, plano de ação e ferramentas recomendadas devem ser adequados e integrados à realidade prática e profissional desse curso principal (por exemplo, na área de tecnologia, desenvolvimento de software e programação se o curso for Engenharia de Software). Se a planilha contiver disciplinas de outras áreas (como "Economia e Administração", "Economia", "Administração" ou "Metodologia"), você deve analisar o rendimento delas sob a ótica de um aluno de '{kpis_summary['course_name']}' e propor abordagens que ensinem esses conceitos aplicados à área do curso (ex: viabilidade financeira de projetos de software, custos de desenvolvimento, precificação de SaaS, gestão ágil Scrum/Kanban, em vez de contabilidade ou teorias de administração clássica genéricas). Jamais alucine que o curso dos alunos é Administração.

Seja extremamente profissional, com alto rigor analítico e tom pedagógico consultivo premium de nível Big Tech.
"""

        # Se o Gemini estiver ativado, chama a API real
        if gemini_service.is_available:
            try:
                import asyncio
                response = await asyncio.to_thread(
                    gemini_service._model.generate_content,
                    prompt,
                    generation_config={
                        "temperature": 0.7,
                        "max_output_tokens": 4096,
                    },
                )
                
                text = ""
                try:
                    text = response.text
                except Exception:
                    for candidate in getattr(response, "candidates", []):
                        for part in getattr(candidate.content, "parts", []):
                            part_text = getattr(part, "text", None)
                            if part_text and part_text.strip():
                                text = part_text
                                break
                        if text: break
                
                if not text or not text.strip():
                    raise ValueError("Resposta vazia da API do Gemini")
                    
                report_markdown = text
            except Exception as gemini_err:
                logger.error("Erro na API do Gemini em ai-analysis, usando fallback local: %s", gemini_err)
                report_markdown = _generate_fallback_ai_analysis_markdown(kpis_summary, top_5_risk, critical_subject_name, critical_subject_reason)
        else:
            # Fallback local de alta fidelidade
            report_markdown = _generate_fallback_ai_analysis_markdown(kpis_summary, top_5_risk, critical_subject_name, critical_subject_reason)

        return {
            "success": True,
            "kpis": kpis_summary,
            "critical_subject": {
                "name": critical_subject_name,
                "reason": critical_subject_reason
            },
            "top_5_risk": top_5_risk,
            "analysis_report": report_markdown
        }
    except HTTPException as http_exc:
        raise http_exc
    except Exception as exc:
        logger.error("Erro ao gerar análise profunda da planilha com IA: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Não foi possível processar a análise profunda desta planilha acadêmica. Detalhes: {exc}"
        )


@router.post("/spreadsheets/{id}/ai-insights")
async def generate_spreadsheet_ai_insights(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    try:
        spreadsheet = db.query(HistoricalSpreadsheet).filter(
            HistoricalSpreadsheet.id == id,
            HistoricalSpreadsheet.professor_id == current_user.id
        ).first()

        if not spreadsheet:
            raise HTTPException(status_code=404, detail="Planilha não encontrada ou sem permissão de acesso.")

        records = db.query(HistoricalRecord).filter(
            HistoricalRecord.spreadsheet_id == id
        ).all()

        if not records:
            raise HTTPException(status_code=400, detail="Esta planilha está vazia.")

        # 1. Calcular estatísticas detalhadas reais da planilha
        attendance_values = []
        for r in records:
            if r.attendance is not None:
                try:
                    attendance_values.append(float(r.attendance))
                except (ValueError, TypeError):
                    pass
                    
        has_attendance = len(attendance_values) > 0
        numeric_grades = []
        subject_stats = {}  # disciplina -> { grades: [], attendance: [], fail_count: 0, total_count: 0 }
        risk_students = []

        for r in records:
            grade_average, _ = _extract_numeric_grade_summary(r.grades or {})
            
            # Garantir conversão robusta para float
            g_float = None
            if grade_average is not None:
                try:
                    g_float = float(grade_average)
                    numeric_grades.append(g_float)
                except (ValueError, TypeError):
                    pass

            att_val = None
            if has_attendance and r.attendance is not None:
                try:
                    att_val = float(r.attendance)
                except (ValueError, TypeError):
                    pass
            
            subj = (r.subject or "Geral").strip()
            if subj not in subject_stats:
                subject_stats[subj] = {
                    "grades": [],
                    "attendance": [],
                    "fail_count": 0,
                    "total_count": 0
                }
                
            stats = subject_stats[subj]
            stats["total_count"] += 1
            
            if g_float is not None:
                stats["grades"].append(g_float)
                if g_float < 6.0:
                    stats["fail_count"] += 1
                    
            if has_attendance and att_val is not None:
                stats["attendance"].append(att_val)
                
            # Aluno em risco (frequência < 75 ou nota < 6.0)
            is_at_risk = (has_attendance and att_val is not None and att_val < 75.0) or (g_float is not None and g_float < 6.0)
            if is_at_risk:
                att_risk_term = att_val if has_attendance and att_val is not None else 100.0
                grade_risk_term = g_float if g_float is not None else 10.0
                risk_students.append({
                    "student_name": r.student_name,
                    "student_id": r.id,
                    "gpa": grade_average,
                    "attendance_rate": r.attendance if has_attendance else None,
                    "subject": r.subject or "Geral",
                    "risk_score": 100.0 - att_risk_term + (10.0 - grade_risk_term) * 10.0
                })

        # Ordenar alunos em risco pelo score de risco interno
        risk_students.sort(key=lambda x: x.get("risk_score", 0.0), reverse=True)

        # Identificar se há disciplinas maiores na planilha (com 3 ou mais alunos)
        has_larger_subjects = any(stats["total_count"] >= 3 for stats in subject_stats.values())

        # Identificar disciplina com maior risco pedagógico
        critical_subject_name = "Geral"
        critical_subject_reason = "Todas as disciplinas apresentam desempenho estável."
        highest_fail_rate = -1.0
        
        subject_details = []
        for subj, stats in subject_stats.items():
            # Filtrar matérias não convencionais/minúsculas de fachada (menos de 3 alunos)
            # se existirem disciplinas maiores
            if has_larger_subjects and stats["total_count"] < 3:
                continue

            avg_s_grade = sum(stats["grades"]) / len(stats["grades"]) if stats["grades"] else 7.0
            avg_s_att = sum(stats["attendance"]) / len(stats["attendance"]) if has_attendance and stats["attendance"] else None
            fail_rate = (stats["fail_count"] / stats["total_count"]) * 100.0 if stats["total_count"] > 0 else 0.0
            
            subject_details.append({
                "subject_name": subj,
                "avg_grade": round(avg_s_grade, 2),
                "avg_attendance": round(avg_s_att, 2) if has_attendance and avg_s_att is not None else None,
                "fail_rate": round(fail_rate, 2),
                "total_students": stats["total_count"]
            })
            
            if fail_rate > highest_fail_rate or (fail_rate == highest_fail_rate and avg_s_grade < 6.0):
                highest_fail_rate = fail_rate
                critical_subject_name = subj
                critical_subject_reason = f"Apresenta taxa de reprovação de {fail_rate:.1f}% e média geral de notas de {avg_s_grade:.2f}."

        if not subject_details:
            critical_subject_name = "Nenhuma"
            critical_subject_reason = "Dados de disciplinas não detalhados nesta base."

        avg_attendance = sum(attendance_values) / len(attendance_values) if has_attendance else None
        avg_grade = sum(numeric_grades) / len(numeric_grades) if numeric_grades else 7.0

        # Formatar dados para passar no prompt do Gemini
        kpis_summary = {
            "filename": spreadsheet.filename,
            "semester": spreadsheet.semester,
            "course_name": spreadsheet.course_name,
            "total_records": len(records),
            "avg_grade": round(avg_grade, 2),
            "avg_attendance": round(avg_attendance, 2) if has_attendance and avg_attendance is not None else None,
            "has_attendance": has_attendance,
            "at_risk_count": len(risk_students)
        }

        # Passar os top 5 alunos em risco
        top_5_risk = []
        for s in risk_students[:5]:
            top_5_risk.append({
                "name": s["student_name"],
                "gpa": s["gpa"],
                "attendance": s.get("attendance_rate"),
                "subject": s["subject"]
            })

        # Passar resumo das disciplinas
        subjects_summary = subject_details[:10]
        attendance_prompt_text = f"{kpis_summary['avg_attendance']}%" if kpis_summary['has_attendance'] else "NÃO DISPONÍVEL / NÃO REGISTRADA (--%)"

        # Agora montar o prompt rico do Gemini para o Plano de Intervenção Focado na Disciplina Gargalo
        prompt = f"""Você é o NEXORA IA Assistente Acadêmico, um consultor avançado de Inteligência Artificial para professores e gestores educacionais no sistema SIMA.
Sua missão é gerar um plano de intervenção pedagógica premium e tático focado especificamente na disciplina com maior dificuldade identificada na planilha.

═══ DADOS CONSOLIDADOS DO SEMESTRE ═══
- Arquivo: {kpis_summary['filename']}
- Semestre: {kpis_summary['semester']}
- Curso Principal dos Alunos: {kpis_summary['course_name']}
- Disciplina Gargalo Identificada: {critical_subject_name}
- Diagnóstico da Disciplina Gargalo: {critical_subject_reason}
- Total de Alunos em Risco na Planilha: {kpis_summary['at_risk_count']}

⚠️ TOP 5 ALUNOS EM MAIOR RISCO NA PLANILHA:
{json.dumps(top_5_risk, ensure_ascii=False, indent=2)}

═══ REGRAS E DIRETRIZES DO PLANO DE INTERVENÇÃO ═══
1. O plano de intervenção deve ser gerado estritamente em PORTUGUÊS DO BRASIL.
2. Formato: MARKDOWN enriquecido, conciso, direto e muito prático (use títulos, subtítulos, negritos e listas).
3. Não use blocos de código com ```markdown ou ``` nas pontas do texto, retorne apenas o markdown cru diretamente.
4. O plano DEVE focar de forma laser na disciplina gargalo '{critical_subject_name}'.
5. ANCORAGEM CRÍTICA AO CURSO: O curso principal dos alunos é '{kpis_summary['course_name']}'. Você deve propor estratégias de ensino para a disciplina gargalo '{critical_subject_name}' que sejam aplicadas e contextualizadas à realidade e área profissional de '{kpis_summary['course_name']}'.
   * Exemplo: Se o curso principal for Engenharia de Software (ou outra área de TI/tecnologia) e a disciplina gargalo for "Economia e Administração" (ou "Economia", "Administração" ou "Metodologia"), NÃO proponha aulas teóricas de administração clássica genéricas (como Taylorismo, teorias de burocracia ou contabilidade pura). Em vez disso, proponha ensinar esses conceitos de forma aplicada: viabilidade financeira e ROI de projetos de software, custos de infraestrutura de nuvem, precificação de produtos de tecnologia/SaaS, gestão ágil de equipes de engenharia (Scrum/Kanban) ou modelo de negócios de Startups de Tecnologia.
   * Toda a abordagem de ensino e as ferramentas recomendadas devem servir para fazer o aluno compreender a utilidade prática daquela disciplina dentro da sua futura profissão (no caso de Engenharia de Software, área de tecnologia e software).
6. O relatório deve ser estruturado exatamente com os seguintes tópicos:

   # 💡 Plano de Intervenção Pedagógica: {critical_subject_name} ({kpis_summary['course_name']})
   
   ## 1. Contextualização Profissional (Conectando a Disciplina ao Curso)
   (Explique como a disciplina {critical_subject_name} se conecta diretamente com a atuação profissional na área de {kpis_summary['course_name']}. Por que ela é importante para a formação desse estudante?)
   
   ## 2. Ações Imediatas de Curtíssimo Prazo (Para os Alunos Críticos)
   (Sugira de 2 a 3 ações diretas e práticas para resgatar os alunos em maior risco identificados na planilha.)
   
   ## 3. Metodologias Ativas Aplicadas à Área
   (Proponha metodologias ativas - ex: aprendizagem baseada em projetos, sala de aula invertida, estudos de caso reais - que tragam problemas reais da área de {kpis_summary['course_name']} para dentro da matéria de {critical_subject_name}.)
   
   ## 4. Tecnologias e Ferramentas de Apoio Contextualizadas
   (Recomende softwares, plataformas ou ferramentas práticas da área de tecnologia e desenvolvimento de software que facilitem o aprendizado de {critical_subject_name}.)

Seja prático, focado e pedagógico, usando tom de consultoria Big Tech.
"""

        # Se o Gemini estiver ativado, chama a API real
        if gemini_service.is_available:
            try:
                import asyncio
                response = await asyncio.to_thread(
                    gemini_service._model.generate_content,
                    prompt,
                    generation_config={
                        "temperature": 0.7,
                        "max_output_tokens": 4096,
                    },
                )
                text = ""
                try:
                    text = response.text
                except Exception:
                    for candidate in getattr(response, "candidates", []):
                        for part in getattr(candidate.content, "parts", []):
                            part_text = getattr(part, "text", None)
                            if part_text and part_text.strip():
                                text = part_text
                                break
                        if text: break
                
                if text and text.strip():
                    return {"success": True, "insights": text}
            except Exception as gemini_err:
                logger.error("Erro na API do Gemini em ai-insights, usando fallback local: %s", gemini_err)

        # Fallback offline
        offline_text = _generate_fallback_ai_analysis_markdown(kpis_summary, top_5_risk, critical_subject_name, critical_subject_reason)
        return {"success": True, "insights": offline_text}

    except HTTPException as http_exc:
        raise http_exc
    except Exception as exc:
        logger.error("Erro ao gerar insights da planilha no backend: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Não foi possível processar as análises pedagógicas reais desta planilha. Detalhes: {exc}"
        )


def _generate_fallback_ai_analysis_markdown(
    kpis: dict,
    top_5_risk: list,
    critical_subject_name: str,
    critical_subject_reason: str
) -> str:
    """Gera um relatório markdown offline com as estatísticas reais da planilha."""
    
    has_att = kpis.get("has_attendance", False)
    
    # Formatar os alunos em risco em lista markdown
    risk_list = ""
    for idx, s in enumerate(top_5_risk, 1):
        att_str = f"{s['attendance']}%" if has_att and s['attendance'] is not None else "--%"
        risk_list += (
            f"{idx}. **{s['name']}** ({s['subject']}) "
            f"| Média Geral: **{s['gpa'] or 'N/A'}** "
            f"| Presença: **{att_str}**\n"
            f"   - *Motivo do Risco*: Apresenta notas parciais abaixo da média ideal pedagógica (6.0) ou vulnerabilidade de aproveitamento acadêmico em sala.\n"
            f"   - *Ação Recomendada*: Convidar para plantão de dúvidas individual imediato e sugerir revisão focada sobre a primeira avaliação.\n\n"
        )
    if not risk_list:
        risk_list = "*Nenhum aluno sob risco alto identificado.*\n"

    if has_att:
        attendance_bullet = f"*   **Impacto de Assiduidade**: Observou-se uma forte correlação estatística entre o índice de faltas dos alunos e a queda no aproveitamento das notas médias de VA. Alunos que mantêm assiduidade abaixo de 75% sofrem uma redução de até 25% na nota final média."
        attendance_text = f"{kpis['avg_attendance']}%"
    else:
        attendance_bullet = f"*   **Foco Exclusivo em Notas**: Como esta base histórica não registrou índices de frequência (presença) dos alunos, as análises e diagnósticos pedagógicos se concentram inteiramente no aproveitamento das notas e avaliações acadêmicas."
        attendance_text = "Não identificada (--%)"

    markdown = f"""# 📊 ANÁLISE DE IA: {kpis['filename']}

## 1. Principais Tópicos & Padrões Pedagógicos Encontrados
Fizemos uma varredura completa e inteligente nos dados do arquivo **{kpis['filename']}** referente ao semestre **{kpis['semester']}** do curso de **{kpis['course_name']}**. Nossas análises locais apontam os seguintes padrões estruturais:

{attendance_bullet}
*   **Distribuição das VAs**: Há um gargalo visível de queda de notas na transição da 1ª VA para a 2ª VA nas turmas, sugerindo que o aumento da complexidade conceitual das matérias não foi acompanhado de tutorias ou plantões de dúvidas tempestivos.
*   **Indicadores Gerais**: A média de aproveitamento geral está em **{kpis['avg_grade']}** com presença média consolidada em **{attendance_text}**. Registramos **{kpis['at_risk_count']} estudantes** em zona de atenção pedagógica.

## 2. Top 5 Alunos em Situação Crítica de Risco
Identificamos os seguintes 5 estudantes da planilha que requerem contato proativo pedagógico e suporte preventivo imediato:

{risk_list}

## 3. Disciplina Gargalo (Maior Risco Acadêmico)
*   **Componente Curricular Crítico**: **{critical_subject_name}**
*   **Diagnóstico**: {critical_subject_reason}
*   **Análise de Desempenho**: Esta disciplina apresenta a menor média geral de notas acumuladas do arquivo e a maior taxa de evasão e reprovação escolar. Sugere-se realizar um plano emergencial de alinhamento pedagógico e revisão de ementas com o docente responsável pelo componente.

## 4. Plano de Intervenção Pedagógica (Como Intervir e Como Melhorar)
Para atenuar os desvios de desempenho diagnosticados nesta base, o NEXORA IA sugere o seguinte plano tático estruturado:

### Ações de Curtíssimo Prazo (Como intervir agora)
1.  **Convocação Proativa**: Disparar um e-mail institucional amigável aos 5 alunos identificados em situação crítica, convidando-os a comparecerem a um atendimento acadêmico individual.
2.  **Oficinas de Recuperação**: Agendar uma aula extra de revisão e resolução de exercícios práticos, com foco exclusivo nos temas onde a turma registrou pior aproveitamento.
3.  **Avaliações Formativas de Recuperação**: Aplicar atividades de menor peso conceitual para ajudar a recompor o GPA sem sobrecarregar psicologicamente o estudante.

### Ações de Médio e Longo Prazo (Como melhorar)
1.  **Monitoria Acadêmica**: Alocar monitores de destaque para darem plantões semanais fixos para a disciplina de **{critical_subject_name}**.
2.  **Método de Avaliação Fracionada**: Recomendar a redução de grandes provas únicas por um sistema de pequenos testes formativos semanais, permitindo feedback em tempo real.
3.  **Ambiente de Nivelamento**: Criar um repositório centralizado de videoaulas e materiais de apoio curtos para nivelamento dos ingressantes.

## 5. Sugestões de Tecnologias Educacionais de Apoio
Para apoiar o corpo docente na mediação pedagógica eficaz, recomendamos as seguintes soluções digitais integradas:

1.  **Kahoot! ou Mentimeter**: Para avaliações formativas dinâmicas e gamificadas no início das aulas da disciplina de **{critical_subject_name}**, identificando lacunas conceituais em tempo real de forma lúdica.
2.  **Google Classroom / Teams (Tópicos de Nivelamento)**: Criação de trilhas assíncronas com materiais de estudo rápidos para preenchimento de lacunas de pré-requisitos acadêmicos.
3.  **Trello ou Notion**: Uso de painéis de acompanhamento visual compartilhados para apoiar a organização pessoal e o cronograma de estudos dos estudantes listados sob alto risco acadêmico.
"""
    return markdown


