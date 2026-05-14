"""
Router de Coordenadores.

Endpoints para o coordenador ver seu perfil, alunos do seu curso
e overview analítico.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from app.database import get_db
from app.models.user import User, UserRole
from app.models.coordinator import Coordinator
from app.models.student import Student, StudentStatus
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.schemas.coordinator import (
    CoordinatorProfileResponse,
    CoordinatorStudentResponse,
    CoordinatorSubjectStudents,
)
from app.security.auth import get_current_user
from app.security.rbac import require_role

router = APIRouter(tags=["Coordenadores"])


# ═══════════════════════════════════════════════
# ENDPOINTS DO COORDENADOR
# ═══════════════════════════════════════════════

@router.get("/api/coordinators/me", response_model=CoordinatorProfileResponse)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.COORDINATOR)),
):
    """Retorna perfil do coordenador logado."""
    coordinator = db.query(Coordinator).filter(Coordinator.user_id == current_user.id).first()
    if not coordinator:
        raise HTTPException(status_code=404, detail="Perfil de coordenador não encontrado")

    return CoordinatorProfileResponse(
        id=coordinator.id,
        user_id=coordinator.user_id,
        phone=coordinator.phone,
        user_name=current_user.full_name,
        user_email=current_user.email,
        academic_course_name=coordinator.academic_course_name,
    )


@router.get("/api/coordinators/me/students")
def get_my_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.COORDINATOR)),
):
    """Retorna todos os alunos do curso que o coordenador coordena."""
    coordinator = db.query(Coordinator).filter(Coordinator.user_id == current_user.id).first()
    if not coordinator:
        raise HTTPException(status_code=404, detail="Perfil de coordenador não encontrado")

    students = (
        db.query(Student)
        .filter(
            Student.course_name == coordinator.academic_course_name,
            Student.status == StudentStatus.ACTIVE,
        )
        .order_by(Student.name)
        .all()
    )

    return [
        {
            "student_id": s.id,
            "student_name": s.name,
            "registration_number": s.registration_number,
            "course_name": s.course_name,
            "current_period": s.current_period,
            "class_schedule": s.class_schedule.value if s.class_schedule and hasattr(s.class_schedule, "value") else (s.class_schedule if isinstance(s.class_schedule, str) else None),
            "email": s.email,
        }
        for s in students
    ]


@router.get("/api/coordinators/me/subjects")
def get_my_subjects(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.COORDINATOR)),
):
    """Retorna todas as disciplinas do curso do coordenador, com alunos matriculados."""
    coordinator = db.query(Coordinator).filter(Coordinator.user_id == current_user.id).first()
    if not coordinator:
        raise HTTPException(status_code=404, detail="Perfil de coordenador não encontrado")

    # Buscar disciplinas que têm alunos do curso do coordenador
    courses = (
        db.query(Course)
        .join(Enrollment, Enrollment.course_id == Course.id)
        .join(Student, Student.id == Enrollment.student_id)
        .filter(Student.course_name == coordinator.academic_course_name)
        .distinct()
        .all()
    )

    result = []
    for course in courses:
        enrollments = (
            db.query(Enrollment)
            .join(Student, Student.id == Enrollment.student_id)
            .filter(
                Enrollment.course_id == course.id,
                Student.course_name == coordinator.academic_course_name,
            )
            .all()
        )

        students_list = []
        for enrollment in enrollments:
            student = db.query(Student).filter(Student.id == enrollment.student_id).first()
            if student:
                students_list.append(CoordinatorStudentResponse(
                    student_id=student.id,
                    student_name=student.name,
                    registration_number=student.registration_number,
                    course_name=student.course_name,
                    current_period=student.current_period,
                    class_schedule=student.class_schedule.value if student.class_schedule and hasattr(student.class_schedule, "value") else (student.class_schedule if isinstance(student.class_schedule, str) else None),
                ))

        students_list.sort(key=lambda s: s.current_period or 0)

        result.append(CoordinatorSubjectStudents(
            course_id=course.id,
            course_name=course.name,
            course_code=course.code,
            students=students_list,
        ))

    return result


@router.get("/api/coordinators/me/overview")
def get_my_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.COORDINATOR)),
):
    """
    Retorna overview analítico com KPIs calculados para todos os alunos
    do curso que o coordenador coordena.
    """
    coordinator = db.query(Coordinator).filter(Coordinator.user_id == current_user.id).first()
    if not coordinator:
        raise HTTPException(status_code=404, detail="Perfil de coordenador não encontrado")

    from app.services.analytics_service import AnalyticsService
    from app.models.grade import Grade
    from app.analytics.utils import _round

    service = AnalyticsService(db)

    # Buscar todos os alunos do curso do coordenador
    students = (
        db.query(Student)
        .filter(
            Student.course_name == coordinator.academic_course_name,
            Student.status == StudentStatus.ACTIVE,
        )
        .all()
    )

    if not students:
        return {
            "kpis": {
                "total_students": 0, "active_students": 0, "total_subjects": 0,
                "average_gpa": 0.0, "average_attendance_rate": 0.0,
                "at_risk_count": 0, "pass_rate": 0.0,
            },
            "risk_summary": {"low": 0, "medium": 0, "high": 0, "critical": 0},
            "top_at_risk": [],
        }

    active_ids = [s.id for s in students]

    # Contar disciplinas do curso
    subject_count = (
        db.query(Course)
        .join(Enrollment, Enrollment.course_id == Course.id)
        .join(Student, Student.id == Enrollment.student_id)
        .filter(Student.course_name == coordinator.academic_course_name)
        .distinct()
        .count()
    )

    # KPIs
    gpas = [service._get_student_gpa(sid) for sid in active_ids]
    attendance_rates = [service._get_student_attendance_rate(sid) for sid in active_ids]

    # Buscar IDs de cursos relevantes
    course_ids = (
        db.query(Course.id)
        .join(Enrollment, Enrollment.course_id == Course.id)
        .join(Student, Student.id == Enrollment.student_id)
        .filter(Student.course_name == coordinator.academic_course_name)
        .distinct()
        .all()
    )
    course_ids = [cid[0] for cid in course_ids]

    all_grades = [g.value for g in db.query(Grade).filter(Grade.course_id.in_(course_ids)).all()] if course_ids else []

    avg_gpa = _round(sum(gpas) / len(gpas), 2) if gpas else 0.0
    avg_att = _round(sum(attendance_rates) / len(attendance_rates), 2) if attendance_rates else 0.0
    at_risk = sum(1 for g in gpas if g < 5.0)
    pass_info = service.stats.compute_pass_rate(all_grades) if all_grades else {"pass_rate": 0.0}

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

    # Top at risk
    student_risks = []
    for s in students:
        gpa = service._get_student_gpa(s.id)
        att = service._get_student_attendance_rate(s.id)
        risk_score = max(0.0, min(1.0, (1 - gpa / 10) * 0.6 + (1 - att / 100) * 0.4))
        student_risks.append({
            "student_id": s.id,
            "student_name": s.name,
            "registration_number": s.registration_number,
            "course_name": s.course_name,
            "gpa": _round(gpa, 2),
            "attendance_rate": _round(att, 2),
            "risk_score": _round(risk_score, 4),
            "risk_level": service._classify_risk(risk_score),
        })
    student_risks.sort(key=lambda x: x["risk_score"], reverse=True)

    return {
        "kpis": {
            "total_students": len(students),
            "active_students": len(active_ids),
            "total_subjects": subject_count,
            "average_gpa": avg_gpa,
            "average_attendance_rate": avg_att,
            "at_risk_count": at_risk,
            "pass_rate": pass_info.get("pass_rate", 0.0),
        },
        "risk_summary": risk_summary,
        "top_at_risk": student_risks[:10],
    }
