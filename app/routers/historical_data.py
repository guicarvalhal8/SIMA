from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Any, Optional
import io
import logging
import re

from app.database import get_db
from app.models.historical_data import HistoricalRecord
from app.models.student import Student
from app.models.user import User, UserRole
from app.schemas.historical_data import HistoricalUploadResponse
from app.security.auth import get_current_user
from app.security.rbac import require_role
from app.services.gemini_service import gemini_service
from app.services.historical_analysis_service import HistoricalAnalysisService
from app.services.historical_export_service import ANALYSIS_TITLES, HistoricalExportService

router = APIRouter(prefix="/api/historical-data", tags=["Dados Historicos"])
logger = logging.getLogger(__name__)


def _require_pandas():
    try:
        import pandas as pd  # type: ignore
        return pd
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="O processamento de planilhas historicas esta indisponivel neste ambiente.",
        ) from exc


def _clean_val(val):
    pd = _require_pandas()
    if pd.isna(val):
        return None
    if isinstance(val, float) and val == int(val):
        return str(int(val))
    return str(val).strip()


def _find_column(cols_upper: dict, exact_names: list) -> str | None:
    for orig_col, upper_col in cols_upper.items():
        if upper_col in exact_names:
            return orig_col
    return None


def _find_column_startswith(cols_upper: dict, prefixes: list) -> str | None:
    for orig_col, upper_col in cols_upper.items():
        if any(upper_col.startswith(prefix) for prefix in prefixes):
            return orig_col
    return None


def _format_student_enum(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "value"):
        return str(value.value)
    return str(value)


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

        numeric_value: float | None = None
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            numeric_value = float(value)
        else:
            try:
                numeric_value = float(str(value).strip().replace(",", "."))
            except (TypeError, ValueError):
                numeric_value = None

        if numeric_value is None:
            continue

        if numeric_value > 10:
            numeric_value = numeric_value / 10 if numeric_value <= 100 else 10.0

        numeric_value = max(0.0, min(float(numeric_value), 10.0))
        numeric_items.append({"label": str(key), "value": round(numeric_value, 2)})

    if not numeric_items:
        return None, []

    average = round(sum(item["value"] for item in numeric_items) / len(numeric_items), 2)
    return average, numeric_items[:4]


def _map_dataframe_to_records(df: Any) -> list[dict]:
    pd = _require_pandas()
    cols_upper = {column: column.upper().strip() for column in df.columns}
    col_map = {}

    mapping_rules = [
        ("student_name", ["NOME_ALUNO", "NOME", "ALUNO", "STUDENT"]),
        ("student_id", ["ID_ALUNO", "MATRICULA", "RA", "COD_ALUNO"]),
        ("course_name", ["NOME_CURSO"]),
        ("course_code", ["COD_CURSO"]),
        ("subject", ["NOME_DISCIPLINA"]),
        ("subject_code", ["COD_DISCIPLINA"]),
        ("semester_year", ["ANO"]),
        ("semester_num", ["SEMESTRE"]),
        ("semester_full", ["SEM_LETIVO", "SEMESTRE_LETIVO"]),
        ("period", ["SERIE", "PERIODO"]),
        ("situation", ["SITUACAO", "SITUACAO", "STATUS", "RESULTADO"]),
        ("grade", ["NOTA", "MEDIA", "NOTA_FINAL", "MEDIA_FINAL"]),
        ("attendance", ["FREQUENCIA", "FREQ", "PRESENCA"]),
        ("absences", ["FALTAS", "FALTA"]),
    ]

    for field, exact_names in mapping_rules:
        if field not in col_map:
            found = _find_column(cols_upper, exact_names)
            if found:
                col_map[field] = found

    startswith_rules = [
        ("course_name", ["NOME_CURS", "NOME_CU"]),
        ("subject", ["NOME_DISC", "NOME_DIS"]),
        ("situation", ["SITUAC"]),
        ("attendance", ["FREQUEN"]),
    ]
    for field, prefixes in startswith_rules:
        if field not in col_map:
            found = _find_column_startswith(cols_upper, prefixes)
            if found:
                col_map[field] = found

    grade_columns = []
    for orig_col, upper_col in cols_upper.items():
        if orig_col in col_map.values():
            continue
        if re.match(r"^(VA|N|NOTA)\d", upper_col) or upper_col == "BOLSA":
            grade_columns.append(orig_col)

    logger.info("Column mapping: %s", col_map)
    logger.info("Extra grade columns: %s", grade_columns)

    records = []
    for _, row in df.iterrows():
        semester = "Desconhecido"
        if "semester_full" in col_map:
            val = row.get(col_map["semester_full"], "")
            semester = str(val) if pd.notna(val) else "Desconhecido"
        elif "semester_year" in col_map:
            year = row.get(col_map["semester_year"], "")
            num = row.get(col_map.get("semester_num", ""), "") if "semester_num" in col_map else ""
            y = _clean_val(year) or ""
            n = _clean_val(num) or ""
            semester = f"{y}-{n}" if y and n else y or "Desconhecido"

        student_name = "N/A"
        if "student_name" in col_map:
            student_name = _clean_val(row.get(col_map["student_name"], "")) or "N/A"
        elif "student_id" in col_map:
            clean_id = _clean_val(row.get(col_map["student_id"], ""))
            student_name = f"Aluno {clean_id}" if clean_id else "N/A"

        course_name = "Desconhecido"
        if "course_name" in col_map:
            course_name = _clean_val(row.get(col_map["course_name"], "")) or "Desconhecido"
        elif "course_code" in col_map:
            course_name = _clean_val(row.get(col_map["course_code"], "")) or "Desconhecido"

        subject = None
        if "subject" in col_map:
            subject = _clean_val(row.get(col_map["subject"], None))
        elif "subject_code" in col_map:
            subject = _clean_val(row.get(col_map["subject_code"], None))

        grades = {}
        if "situation" in col_map:
            val = row.get(col_map["situation"], "")
            if pd.notna(val):
                grades["SITUACAO"] = str(val)
        if "grade" in col_map:
            val = row.get(col_map["grade"], None)
            if pd.notna(val):
                try:
                    grades["Nota"] = float(val)
                except (ValueError, TypeError):
                    grades["Nota"] = str(val)
        for grade_column in grade_columns:
            val = row.get(grade_column, None)
            if pd.notna(val):
                label = cols_upper[grade_column]
                try:
                    grades[label] = float(val)
                except (ValueError, TypeError):
                    grades[label] = str(val)

        attendance = None
        if "attendance" in col_map:
            val = row.get(col_map["attendance"], None)
            if pd.notna(val):
                try:
                    attendance = float(val)
                except (ValueError, TypeError):
                    attendance = None
        elif "absences" in col_map:
            val = row.get(col_map["absences"], None)
            if pd.notna(val):
                try:
                    attendance = max(0, 100 - float(val))
                except (ValueError, TypeError):
                    attendance = None

        period = None
        if "period" in col_map:
            val = row.get(col_map["period"], None)
            if pd.notna(val):
                try:
                    period = int(float(val))
                except (ValueError, TypeError):
                    period = None

        records.append({
            "semester": semester,
            "course_name": course_name,
            "subject": subject,
            "period": period,
            "student_name": student_name,
            "grades": grades,
            "attendance": attendance,
        })

    return records


def _parse_csv(content: bytes) -> Any:
    pd = _require_pandas()
    best_df = None
    best_cols = 0

    for sep in [";", ",", "\t"]:
        for encoding in ["utf-8", "latin-1", "cp1252"]:
            try:
                candidate = pd.read_csv(io.BytesIO(content), sep=sep, encoding=encoding, on_bad_lines="skip")
                if len(candidate) > 0 and len(candidate.columns) > best_cols:
                    best_df = candidate
                    best_cols = len(candidate.columns)
            except Exception:
                continue
        if best_cols >= 3:
            break

    if best_df is None or best_cols <= 1:
        try:
            candidate = pd.read_csv(io.BytesIO(content), sep=None, engine="python", on_bad_lines="skip")
            if len(candidate) > 0 and len(candidate.columns) > best_cols:
                best_df = candidate
        except Exception:
            pass

    return best_df


@router.post("/upload", response_model=HistoricalUploadResponse)
async def upload_historical_spreadsheet(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR)),
):
    content = await file.read()
    filename = (file.filename or "").lower()

    try:
        records_data = []

        if filename.endswith(".csv"):
            df = _parse_csv(content)
            if df is not None and len(df) > 0:
                logger.info("CSV parsed: %s rows, %s cols", len(df), len(df.columns))
                records_data = _map_dataframe_to_records(df)
            else:
                raise HTTPException(status_code=422, detail="Nao foi possivel ler o CSV. Verifique o formato.")

        elif filename.endswith((".xls", ".xlsx")):
            pd = _require_pandas()
            df = pd.read_excel(io.BytesIO(content))
            logger.info("Excel parsed: %s rows, %s cols", len(df), len(df.columns))
            records_data = _map_dataframe_to_records(df)

        elif filename.endswith(".txt"):
            spreadsheet_text = ""
            for encoding in ["utf-8", "latin-1", "cp1252"]:
                try:
                    spreadsheet_text = content.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue
            if not spreadsheet_text:
                spreadsheet_text = content.decode("utf-8", errors="ignore")
            if len(spreadsheet_text) > 15000:
                spreadsheet_text = spreadsheet_text[:15000]
            records_data = await gemini_service.parse_historical_spreadsheet(spreadsheet_text)

        elif filename.endswith(".pdf"):
            import pdfplumber

            pages_text = []
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        pages_text.append(text)
                    tables = page.extract_tables()
                    for table in tables:
                        for row in table:
                            if row:
                                pages_text.append(" | ".join([str(cell) if cell else "" for cell in row]))
            spreadsheet_text = "\n".join(pages_text)
            if len(spreadsheet_text) > 15000:
                spreadsheet_text = spreadsheet_text[:15000]
            records_data = await gemini_service.parse_historical_spreadsheet(spreadsheet_text)

        else:
            raise HTTPException(status_code=400, detail="Formato nao suportado. Use CSV, Excel, TXT ou PDF.")

        if not records_data:
            raise HTTPException(status_code=422, detail="Nenhum dado foi extraido do arquivo.")

        new_records = []
        for record_data in records_data:
            record = HistoricalRecord(
                semester=record_data.get("semester", "Desconhecido"),
                course_name=record_data.get("course_name", "Desconhecido"),
                subject=record_data.get("subject"),
                period=record_data.get("period"),
                student_name=record_data.get("student_name", "N/A"),
                grades=record_data.get("grades", {}),
                attendance=record_data.get("attendance"),
                professor_id=current_user.id,
            )
            db.add(record)
            new_records.append(record)

        db.commit()

        unique_courses = sorted({record.get("course_name") for record in records_data if record.get("course_name")})
        unique_subjects = sorted({record.get("subject") for record in records_data if record.get("subject")})
        attendance_values = [float(record.get("attendance")) for record in records_data if record.get("attendance") is not None]
        numeric_grades = []
        for record in records_data:
            for value in (record.get("grades") or {}).values():
                if isinstance(value, (int, float)):
                    numeric_grades.append(float(value))

        return {
            "message": "Dados processados e salvos com sucesso",
            "records_count": len(new_records),
            "semester": records_data[0].get("semester", "Multiplos") if records_data else "N/A",
            "course_organized": True,
            "courses": unique_courses[:5],
            "subjects": unique_subjects[:8],
            "summary": {
                "avg_attendance": round(sum(attendance_values) / len(attendance_values), 2) if attendance_values else None,
                "avg_grade": round(sum(numeric_grades) / len(numeric_grades), 2) if numeric_grades else None,
                "students": len({record.get("student_name") for record in records_data if record.get("student_name")}),
            },
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.error("Erro ao processar arquivo: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao processar arquivo: {exc}") from exc


@router.delete("/clear")
def clear_historical_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR)),
):
    deleted = db.query(HistoricalRecord).filter(
        HistoricalRecord.professor_id == current_user.id
    ).delete()
    db.commit()
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = HistoricalAnalysisService(db)
    return service.build_workspace(
        current_user=current_user,
        semester=semester,
        course_name=course_name,
        subject=subject,
    )


@router.get("/analysis-workspace/at-risk-students")
def get_at_risk_students_by_class(
    class_key: str = Query(...),
    semester: Optional[str] = Query(None),
    course_name: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
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
    current_user: User = Depends(require_role(UserRole.PROFESSOR)),
):
    message = request.get("message", "")
    file_content = request.get("file_content", "")

    if not message:
        raise HTTPException(status_code=400, detail="Mensagem e obrigatoria")
    if not file_content:
        raise HTTPException(status_code=400, detail="Conteudo da planilha e obrigatorio")

    try:
        response_text = await gemini_service.chat_with_file(
            message=message,
            file_content=file_content,
            kpis={},
            risk_students=[],
        )
        return {"response": response_text}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao processar: {exc}") from exc


@router.post("/insights")
async def generate_historical_insights(
    request: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR)),
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

    records_summary = "\n".join(lines)

    try:
        response_text = await gemini_service.chat_historical_insights(
            message=message,
            records_summary=records_summary,
            total_records=len(records),
        )
        return {"response": response_text}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar insights: {exc}") from exc
