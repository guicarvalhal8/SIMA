from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from app.database import get_db
from app.models.user import User, UserRole
from app.models.professor import Professor, ProfessorAcademicCourse, ProfessorCourse
from app.models.student import Student, StudentStatus
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.scraped_data import ScrapedAttendance, ScrapedGrade, ScrapedSubject
from app.security.auth import get_current_user
from app.security.rbac import require_role
from app.security.audit import audit_logger
from app.utils.subject_name import clean_subject_name, normalize_subject_key

router = APIRouter(tags=["Professores"])

ALLOWED_PROFESSOR_ROLES = (UserRole.PROFESSOR, UserRole.ADMIN)

def _build_student_subject_key_map(db: Session, student_ids: list[int]) -> dict[int, set[str]]:
    subject_map: dict[int, set[str]] = {}
    if not student_ids:
        return subject_map

    for model, column in [
        (ScrapedSubject, ScrapedSubject.disciplina),
        (ScrapedGrade, ScrapedGrade.disciplina),
        (ScrapedAttendance, ScrapedAttendance.disciplina),
    ]:
        rows = db.query(model.student_id, column).filter(model.student_id.in_(student_ids)).all()
        for student_id, name in rows:
            subject_key = normalize_subject_key(name)
            if not subject_key:
                continue
            subject_map.setdefault(student_id, set()).add(subject_key)

    enrollment_rows = (
        db.query(Enrollment.student_id, Course.name)
        .join(Course, Course.id == Enrollment.course_id)
        .filter(Enrollment.student_id.in_(student_ids))
        .all()
    )
    for student_id, name in enrollment_rows:
        subject_key = normalize_subject_key(name)
        if not subject_key:
            continue
        subject_map.setdefault(student_id, set()).add(subject_key)

    return subject_map


def _build_student_subject_label_map(db: Session, student_ids: list[int]) -> dict[str, str]:
    label_map: dict[str, str] = {}
    if not student_ids:
        return label_map

    for model, column in [
        (ScrapedSubject, ScrapedSubject.disciplina),
        (ScrapedGrade, ScrapedGrade.disciplina),
        (ScrapedAttendance, ScrapedAttendance.disciplina),
    ]:
        rows = db.query(column).filter(model.student_id.in_(student_ids)).distinct().all()
        for (name,) in rows:
            cleaned_name = clean_subject_name(name)
            subject_key = normalize_subject_key(cleaned_name)
            if subject_key and subject_key not in label_map:
                label_map[subject_key] = cleaned_name

    enrollment_rows = (
        db.query(Course.name)
        .join(Enrollment, Enrollment.course_id == Course.id)
        .filter(Enrollment.student_id.in_(student_ids))
        .distinct()
        .all()
    )
    for (name,) in enrollment_rows:
        cleaned_name = clean_subject_name(name)
        subject_key = normalize_subject_key(cleaned_name)
        if subject_key and subject_key not in label_map:
            label_map[subject_key] = cleaned_name

    return label_map


def _get_selected_professor_course_ids(professor: Professor | None) -> set[int]:
    return {
        professor_course.course_id
        for professor_course in (professor.professor_courses if professor else [])
        if professor_course.course_id
    }


def _serialize_student_reference(student: Student) -> dict:
    class_schedule = student.class_schedule.value if getattr(student.class_schedule, "value", None) else student.class_schedule
    return {
        "student_id": student.id,
        "student_name": student.name,
        "registration_number": student.registration_number,
        "course_name": student.course_name,
        "current_period": student.current_period,
        "class_schedule": class_schedule,
    }


def _build_professor_course_catalog(
    db: Session,
    professor: Professor | None,
    current_user: User,
    *,
    include_students: bool = False,
) -> list[dict]:
    academic_course_names = _get_professor_academic_courses(db, professor, current_user)
    query = db.query(Student).filter(Student.status == StudentStatus.ACTIVE)

    if academic_course_names:
        query = query.filter(Student.course_name.in_(academic_course_names))
    elif current_user.role != UserRole.ADMIN:
        return []

    students = query.order_by(Student.course_name.asc(), Student.name.asc()).all()
    student_ids = [student.id for student in students]
    if not student_ids:
        return []

    selected_course_ids = _get_selected_professor_course_ids(professor)
    student_subject_keys = _build_student_subject_key_map(db, student_ids)
    subject_label_map = _build_student_subject_label_map(db, student_ids)
    catalog_courses = db.query(Course).all()
    course_by_subject_key = {
        normalize_subject_key(course.name): course
        for course in catalog_courses
        if course.name and normalize_subject_key(course.name)
    }

    grouped_entries: dict[str, dict[str, dict]] = {}

    for student in students:
        academic_course_name = student.course_name or "Sem curso academico"
        academic_bucket = grouped_entries.setdefault(academic_course_name, {})

        for subject_key in student_subject_keys.get(student.id, set()):
            matched_course = course_by_subject_key.get(subject_key)
            display_name = clean_subject_name(
                matched_course.name if matched_course and matched_course.name else subject_label_map.get(subject_key) or subject_key
            )

            entry = academic_bucket.setdefault(subject_key, {
                "academic_course_name": academic_course_name,
                "id": matched_course.id if matched_course else None,
                "name": display_name,
                "code": matched_course.code if matched_course else "",
                "department": matched_course.department if matched_course else None,
                "selected": bool(matched_course and matched_course.id in selected_course_ids),
                "selection_enabled": matched_course is not None,
                "student_count": 0,
                "periods": set(),
                "students": [],
            })

            entry["student_count"] += 1
            if student.current_period is not None:
                entry["periods"].add(student.current_period)
            if include_students:
                entry["students"].append(_serialize_student_reference(student))

    payload: list[dict] = []
    for academic_course_name in sorted(grouped_entries.keys()):
        subject_entries = list(grouped_entries[academic_course_name].values())
        subject_entries.sort(key=lambda item: item["name"].lower())

        for entry in subject_entries:
            entry["periods"] = sorted(entry["periods"])
            if not include_students:
                entry.pop("students", None)
            payload.append(entry)

    return payload


def _ensure_professor_like_access(current_user: User):
    if current_user.role not in ALLOWED_PROFESSOR_ROLES:
        raise HTTPException(status_code=403, detail="Acesso restrito a professores e pro-reitoria")


def _resolve_professor_profile(db: Session, current_user: User, create_for_admin: bool = False) -> Professor | None:
    professor = (
        db.query(Professor)
        .options(joinedload(Professor.professor_courses), joinedload(Professor.academic_courses))
        .filter(Professor.user_id == current_user.id)
        .first()
    )
    if professor or not create_for_admin or current_user.role != UserRole.ADMIN:
        return professor

    professor = Professor(user_id=current_user.id, phone=None)
    db.add(professor)
    db.flush()
    db.refresh(professor)
    return professor


def _get_professor_academic_courses(db: Session, professor: Professor | None, current_user: User) -> list[str]:
    academic_course_names = [ac.course_name for ac in (professor.academic_courses if professor else []) if ac.course_name]
    if academic_course_names or current_user.role != UserRole.ADMIN:
        return academic_course_names

    rows = (
        db.query(Student.course_name)
        .filter(Student.status == StudentStatus.ACTIVE, Student.course_name.isnot(None))
        .distinct()
        .all()
    )
    return sorted({row[0] for row in rows if row[0]})


def _get_professor_student_ids(db: Session, professor: Professor | None, current_user: User) -> list[int]:
    academic_course_names = _get_professor_academic_courses(db, professor, current_user)
    query = db.query(Student.id).filter(Student.status == StudentStatus.ACTIVE)

    if academic_course_names:
        query = query.filter(Student.course_name.in_(academic_course_names))
    elif current_user.role != UserRole.ADMIN:
        return []

    return [row[0] for row in query.distinct().all()]


def _get_professor_subject_names(db: Session, student_ids: list[int]) -> list[str]:
    if not student_ids:
        return []

    return sorted(_build_student_subject_label_map(db, student_ids).values())


def _serialize_professor_courses(db: Session, professor: Professor | None, current_user: User) -> list[dict]:
    return _build_professor_course_catalog(db, professor, current_user, include_students=False)


def _get_professor_course_records(db: Session, professor: Professor | None, current_user: User) -> list[Course]:
    course_ids = sorted(_get_selected_professor_course_ids(professor))
    if not course_ids:
        courses = _serialize_professor_courses(db, professor, current_user)
        course_ids = [course["id"] for course in courses if course.get("id")]
    if course_ids:
        return db.query(Course).filter(Course.id.in_(course_ids)).order_by(Course.name.asc()).all()

    if current_user.role == UserRole.ADMIN:
        return db.query(Course).order_by(Course.name.asc()).all()

    return []


@router.get("/api/professors/me")
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_professor_like_access(current_user)

    professor = _resolve_professor_profile(db, current_user, create_for_admin=True)
    if not professor:
        raise HTTPException(status_code=404, detail="Perfil de professor nao encontrado")

    return {
        "id": professor.id,
        "user_id": professor.user_id,
        "phone": professor.phone,
        "user_name": current_user.full_name,
        "user_email": current_user.email,
        "courses": _serialize_professor_courses(db, professor, current_user),
        "selected_course_ids": sorted(_get_selected_professor_course_ids(professor)),
        "academic_courses": _get_professor_academic_courses(db, professor, current_user),
    }


@router.put("/api/professors/me/academic-courses")
def update_my_academic_courses(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_professor_like_access(current_user)

    professor = _resolve_professor_profile(db, current_user, create_for_admin=True)
    if not professor:
        raise HTTPException(status_code=404, detail="Perfil de professor nao encontrado")

    course_names = [str(name).strip() for name in data.get("course_names", []) if str(name).strip()]
    db.query(ProfessorAcademicCourse).filter(ProfessorAcademicCourse.professor_id == professor.id).delete()
    for name in course_names:
        db.add(ProfessorAcademicCourse(professor_id=professor.id, course_name=name))

    db.commit()
    return {"detail": "Cursos academicos atualizados", "course_names": course_names}


@router.get("/api/professors/me/students")
def get_my_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    professor = _resolve_professor_profile(db, current_user, create_for_admin=True)
    if not professor:
        raise HTTPException(status_code=404, detail="Perfil de professor nao encontrado")

    result = []
    for entry in _build_professor_course_catalog(db, professor, current_user, include_students=True):
        result.append({
            "academic_course_name": entry["academic_course_name"],
            "course_id": entry["id"],
            "course_name": entry["name"],
            "course_code": entry["code"],
            "student_count": entry["student_count"],
            "periods": entry["periods"],
            "selected": entry["selected"],
            "students": entry["students"],
        })

    return result


@router.put("/api/professors/me/courses")
def update_my_courses(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR, UserRole.ADMIN)),
):
    professor = _resolve_professor_profile(db, current_user, create_for_admin=True)
    if not professor:
        raise HTTPException(status_code=404, detail="Perfil de professor nao encontrado")

    selected_course_ids = []
    for value in data.get("course_ids", []):
        try:
            course_id = int(value)
        except (TypeError, ValueError):
            continue
        if course_id not in selected_course_ids:
            selected_course_ids.append(course_id)

    available_course_ids = {
        course["id"]
        for course in _serialize_professor_courses(db, professor, current_user)
        if course.get("id")
    }
    invalid_ids = [course_id for course_id in selected_course_ids if course_id not in available_course_ids]
    if invalid_ids:
        raise HTTPException(status_code=400, detail="Uma ou mais disciplinas nao pertencem ao seu escopo atual.")

    db.query(ProfessorCourse).filter(ProfessorCourse.professor_id == professor.id).delete(synchronize_session=False)
    for course_id in selected_course_ids:
        db.add(ProfessorCourse(professor_id=professor.id, course_id=course_id))

    db.commit()
    db.refresh(professor)

    audit_logger.log_data_change(current_user.username, "ProfessorCourse", "UPDATE_SELECTION", professor.id)
    return {
        "detail": "Disciplinas do professor atualizadas com sucesso.",
        "course_ids": selected_course_ids,
        "courses": _serialize_professor_courses(db, professor, current_user),
    }


@router.get("/api/professors/me/overview")
def get_my_overview(
    course_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_professor_like_access(current_user)

    professor = _resolve_professor_profile(db, current_user, create_for_admin=True)
    if not professor:
        raise HTTPException(status_code=404, detail="Perfil de professor nao encontrado")

    from app.services.analytics_service import AnalyticsService
    from app.models.grade import Grade
    from app.analytics.utils import _round

    service = AnalyticsService(db)

    student_ids = _get_professor_student_ids(db, professor, current_user)
    discipline_names = _get_professor_subject_names(db, student_ids)
    prof_course_ids = [course.id for course in _get_professor_course_records(db, professor, current_user) if course.id]

    if course_id:
        course = db.query(Course).filter(Course.id == course_id).first()
        cleaned_course_name = clean_subject_name(course.name) if course else None
        if not course or cleaned_course_name not in discipline_names:
            raise HTTPException(status_code=404, detail="Disciplina nao encontrada no seu perfil")
        discipline_names = [cleaned_course_name]
        subject_key = normalize_subject_key(cleaned_course_name)
        student_subject_keys = _build_student_subject_key_map(db, student_ids)
        student_ids = [
            sid for sid in student_ids
            if subject_key in student_subject_keys.get(sid, set())
        ]

    if not student_ids and current_user.role == UserRole.ADMIN:
        active_students = db.query(Student).filter(Student.status == StudentStatus.ACTIVE).all()
        student_ids = [student.id for student in active_students]

    if not student_ids:
        return {
            "kpis": {
                "total_students": 0,
                "active_students": 0,
                "total_courses": 0,
                "average_gpa": 0.0,
                "average_attendance_rate": 0.0,
                "at_risk_count": 0,
                "pass_rate": 0.0,
            },
            "risk_summary": {"low": 0, "medium": 0, "high": 0, "critical": 0},
            "top_at_risk": [],
        }

    active_students = db.query(Student).filter(Student.id.in_(student_ids), Student.status == StudentStatus.ACTIVE).all()
    active_ids = [student.id for student in active_students]

    gpas = [service._get_student_gpa(student_id) for student_id in active_ids]
    attendance_rates = [service._get_student_attendance_rate(student_id) for student_id in active_ids]
    all_grades = [grade.value for grade in db.query(Grade).filter(Grade.course_id.in_(prof_course_ids)).all()] if prof_course_ids else []

    avg_gpa = _round(sum(gpas) / len(gpas), 2) if gpas else 0.0
    avg_attendance = _round(sum(attendance_rates) / len(attendance_rates), 2) if attendance_rates else 0.0
    at_risk = sum(1 for gpa in gpas if gpa < 5.0)
    pass_info = service.stats.compute_pass_rate(all_grades) if all_grades else {"pass_rate": 0.0}

    risk_summary = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    for gpa, attendance in zip(gpas, attendance_rates):
        if gpa < 4.0 or attendance < 60.0:
            risk_summary["critical"] += 1
        elif gpa < 5.0 or attendance < 70.0:
            risk_summary["high"] += 1
        elif gpa < 6.0 or attendance < 80.0:
            risk_summary["medium"] += 1
        else:
            risk_summary["low"] += 1

    student_risks = []
    for student in active_students:
        gpa = service._get_student_gpa(student.id)
        attendance = service._get_student_attendance_rate(student.id)
        risk_score = max(0.0, min(1.0, (1 - gpa / 10) * 0.6 + (1 - attendance / 100) * 0.4))
        student_risks.append({
            "student_id": student.id,
            "student_name": student.name,
            "registration_number": student.registration_number,
            "course_name": student.course_name,
            "gpa": _round(gpa, 2),
            "attendance_rate": _round(attendance, 2),
            "risk_score": _round(risk_score, 4),
            "risk_level": service._classify_risk(risk_score),
        })
    student_risks.sort(key=lambda item: item["risk_score"], reverse=True)

    return {
        "kpis": {
            "total_students": len(student_ids),
            "active_students": len(active_ids),
            "total_courses": len(discipline_names),
            "average_gpa": avg_gpa,
            "average_attendance_rate": avg_attendance,
            "at_risk_count": at_risk,
            "pass_rate": pass_info.get("pass_rate", 0.0),
        },
        "risk_summary": risk_summary,
        "top_at_risk": student_risks[:10],
    }


@router.get("/api/courses/available")
def list_available_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    professor = _resolve_professor_profile(db, current_user, create_for_admin=True)
    if not professor:
        return []

    return _serialize_professor_courses(db, professor, current_user)

