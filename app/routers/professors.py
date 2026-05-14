"""
Router de Professores.

Endpoints para o professor ver seu perfil, alunos e overview analítico.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List

from app.database import get_db
from app.models.user import User, UserRole
from app.models.professor import Professor, ProfessorCourse, ProfessorAcademicCourse
from app.models.student import Student, StudentStatus
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.schemas.professor import (
    ProfessorSubjectStudents,
    ProfessorStudentResponse,
)
from app.security.auth import get_current_user
from app.security.rbac import require_role
from app.security.audit import audit_logger

router = APIRouter(tags=["Professores"])


# ═══════════════════════════════════════════════
# ENDPOINTS DO PROFESSOR
# ═══════════════════════════════════════════════

@router.get("/api/professors/me")
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna perfil do professor logado."""
    if current_user.role != UserRole.PROFESSOR:
        raise HTTPException(status_code=403, detail="Acesso restrito a professores")

    professor = db.query(Professor).filter(Professor.user_id == current_user.id).first()
    if not professor:
        raise HTTPException(status_code=404, detail="Perfil de professor não encontrado")

    # Carregar cursos (matérias/disciplinas)
    courses = []
    for pc in professor.professor_courses:
        course = db.query(Course).filter(Course.id == pc.course_id).first()
        if course:
            courses.append({"id": course.id, "name": course.name, "code": course.code})

    # Carregar cursos acadêmicos (IA, Nutrição, etc)
    academic_courses = [ac.course_name for ac in professor.academic_courses]

    return {
        "id": professor.id,
        "user_id": professor.user_id,
        "phone": professor.phone,
        "user_name": current_user.full_name,
        "user_email": current_user.email,
        "courses": courses,
        "academic_courses": academic_courses,
    }


@router.put("/api/professors/me/academic-courses")
def update_my_academic_courses(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza os cursos acadêmicos (IA, Nutrição) que o professor atua."""
    if current_user.role != UserRole.PROFESSOR:
        raise HTTPException(status_code=403, detail="Acesso restrito a professores")

    professor = db.query(Professor).filter(Professor.user_id == current_user.id).first()
    if not professor:
        raise HTTPException(status_code=404, detail="Perfil de professor não encontrado")

    course_names = data.get("course_names", [])

    # Remover antigos
    db.query(ProfessorAcademicCourse).filter(ProfessorAcademicCourse.professor_id == professor.id).delete()

    # Adicionar novos
    for name in course_names:
        db.add(ProfessorAcademicCourse(professor_id=professor.id, course_name=name))

    db.commit()
    return {"detail": "Cursos acadêmicos atualizados", "course_names": course_names}


@router.get("/api/professors/me/students")
def get_my_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR)),
):
    """
    Retorna alunos do professor, agrupados por disciplina.
    
    Busca alunos através de duas rotas:
    1. ProfessorAcademicCourse → Student.course_name (dados scraping)
    2. ProfessorCourse → Course → Enrollment → Student (dados manuais)
    """
    from app.models.scraped_data import ScrapedGrade

    professor = (
        db.query(Professor)
        .options(joinedload(Professor.professor_courses))
        .filter(Professor.user_id == current_user.id)
        .first()
    )
    if not professor:
        raise HTTPException(status_code=404, detail="Perfil de professor não encontrado")

    # Obter cursos acadêmicos do professor (ex: "Inteligência Artificial")
    academic_course_names = [ac.course_name for ac in professor.academic_courses]

    # Coletar TODOS os alunos únicos que o professor deve ver
    seen_student_ids = set()
    all_students = []

    # Rota 1: Alunos pelo curso acadêmico (Student.course_name)
    if academic_course_names:
        students_by_course = (
            db.query(Student)
            .filter(
                Student.course_name.in_(academic_course_names),
                Student.status == StudentStatus.ACTIVE,
            )
            .all()
        )
        for s in students_by_course:
            if s.id not in seen_student_ids:
                seen_student_ids.add(s.id)
                all_students.append(s)

    # Rota 2: Alunos via enrollment (dados manuais)  
    for pc in professor.professor_courses:
        course = db.query(Course).filter(Course.id == pc.course_id).first()
        if not course:
            continue
        enrollments = db.query(Enrollment).filter(Enrollment.course_id == course.id).all()
        for enrollment in enrollments:
            if enrollment.student_id not in seen_student_ids:
                student = db.query(Student).filter(
                    Student.id == enrollment.student_id,
                    Student.status == StudentStatus.ACTIVE,
                ).first()
                if student:
                    seen_student_ids.add(student.id)
                    all_students.append(student)

    # Agora agrupar alunos por disciplina
    # Primeiro, coletar as disciplinas que o professor selecionou
    prof_subject_names = set()
    for pc in professor.professor_courses:
        course = db.query(Course).filter(Course.id == pc.course_id).first()
        if course:
            prof_subject_names.add(course.name)

    # Se não tem disciplinas selecionadas, usar TODAS as do scraping para estes alunos
    if not prof_subject_names and all_students:
        student_ids = [s.id for s in all_students]
        scraped_disciplines = (
            db.query(ScrapedGrade.disciplina)
            .filter(ScrapedGrade.student_id.in_(student_ids))
            .distinct()
            .all()
        )
        prof_subject_names = {d[0] for d in scraped_disciplines if d[0]}

    result = []
    for subj_name in sorted(prof_subject_names):
        matched_course = db.query(Course).filter(Course.name == subj_name).first()
        students_in_subject = []
        for student in all_students:
            # Checar se o aluno tem notas nessa disciplina (via scraping)
            has_grade = db.query(ScrapedGrade).filter(
                ScrapedGrade.student_id == student.id,
                ScrapedGrade.disciplina == subj_name,
            ).first()
            
            # Ou checar via enrollment
            if not has_grade:
                course = db.query(Course).filter(Course.name == subj_name).first()
                if course:
                    has_enrollment = db.query(Enrollment).filter(
                        Enrollment.student_id == student.id,
                        Enrollment.course_id == course.id,
                    ).first()
                    if not has_enrollment:
                        continue
                else:
                    continue

            students_in_subject.append({
                "student_id": student.id,
                "student_name": student.name,
                "registration_number": student.registration_number,
                "course_name": student.course_name,
                "current_period": student.current_period,
                "class_schedule": student.class_schedule.value if student.class_schedule and hasattr(student.class_schedule, "value") else (student.class_schedule if isinstance(student.class_schedule, str) else None),
            })

        if students_in_subject:
            students_in_subject.sort(key=lambda s: s.get("current_period") or 0)
            result.append({
                "course_id": matched_course.id if matched_course else None,
                "course_name": subj_name,
                "course_code": matched_course.code if matched_course else "",
                "students": students_in_subject,
            })

    return result


@router.put("/api/professors/me/courses")
def update_my_courses(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PROFESSOR)),
):

    professor = db.query(Professor).filter(Professor.user_id == current_user.id).first()
    if not professor:
        raise HTTPException(status_code=404, detail="Perfil de professor não encontrado")

    course_ids = data.get("course_ids", [])

    # Remover cursos antigos
    db.query(ProfessorCourse).filter(ProfessorCourse.professor_id == professor.id).delete()

    # Adicionar novos — aceita tanto IDs inteiros quanto nomes de disciplinas (scraping)
    for cid in course_ids:
        course = None
        try:
            cid_int = int(cid)
            course = db.query(Course).filter(Course.id == cid_int).first()
        except (ValueError, TypeError):
            # É um nome de disciplina (string) — buscar ou criar Course
            if isinstance(cid, str) and cid.strip():
                course = db.query(Course).filter(Course.name == cid).first()
                if not course:
                    # Criar a disciplina no banco com campos obrigatórios
                    import hashlib
                    unique_code = f"PROF-{hashlib.md5(cid.encode()).hexdigest()[:6].upper()}"
                    # Garantir que o código é único
                    existing_code = db.query(Course).filter(Course.code == unique_code).first()
                    if existing_code:
                        unique_code = f"PROF-{hashlib.md5((cid + str(professor.id)).encode()).hexdigest()[:6].upper()}"
                    course = Course(
                        name=cid,
                        code=unique_code,
                        department="Geral",
                        semester="2025.1",
                        credits=4,
                    )
                    db.add(course)
                    db.flush()

        if course:
            # Evitar duplicatas
            existing = db.query(ProfessorCourse).filter(
                ProfessorCourse.professor_id == professor.id,
                ProfessorCourse.course_id == course.id,
            ).first()
            if not existing:
                db.add(ProfessorCourse(professor_id=professor.id, course_id=course.id))

    db.commit()
    audit_logger.log_data_change(current_user.username, "ProfessorCourse", "UPDATE", professor.id)

    # Retornar cursos atualizados
    courses = []
    for pc in db.query(ProfessorCourse).filter(ProfessorCourse.professor_id == professor.id).all():
        course = db.query(Course).filter(Course.id == pc.course_id).first()
        if course:
            courses.append({"id": course.id, "name": course.name, "code": course.code})

    return {"detail": "Disciplinas atualizadas", "courses": courses}


@router.get("/api/professors/me/overview")
def get_my_overview(
    course_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna overview analítico com KPIs calculados apenas para os alunos
    matriculados nas disciplinas do professor logado.
    Aceita course_id opcional para filtrar por disciplina específica.
    """
    if current_user.role != UserRole.PROFESSOR:
        raise HTTPException(status_code=403, detail="Acesso restrito a professores")

    professor = db.query(Professor).filter(Professor.user_id == current_user.id).first()
    if not professor:
        raise HTTPException(status_code=404, detail="Perfil de professor não encontrado")

    from app.services.analytics_service import AnalyticsService
    from app.models.grade import Grade
    from app.models.attendance import Attendance
    from app.analytics.utils import _round

    service = AnalyticsService(db)

    # Buscar alunos via scraped data das disciplinas selecionadas pelo professor
    from app.models.scraped_data import ScrapedGrade, ScrapedAttendance

    # Obter nomes das disciplinas selecionadas
    discipline_names = []
    prof_course_ids = [pc.course_id for pc in professor.professor_courses]
    for cid in prof_course_ids:
        c = db.query(Course).filter(Course.id == cid).first()
        if c:
            discipline_names.append(c.name)

    if course_id:
        # Validar que o curso pertence ao professor
        pc = db.query(ProfessorCourse).filter(
            ProfessorCourse.professor_id == professor.id,
            ProfessorCourse.course_id == course_id,
        ).first()
        if not pc:
            raise HTTPException(status_code=404, detail="Disciplina não encontrada no seu perfil")
        c = db.query(Course).filter(Course.id == course_id).first()
        discipline_names = [c.name] if c else []

    # Coletar alunos com scraped data nas disciplinas selecionadas
    seen_ids = set()
    if discipline_names:
        for ScrapedModel, col in [
            (ScrapedGrade, ScrapedGrade.disciplina),
            (ScrapedAttendance, ScrapedAttendance.disciplina),
        ]:
            rows = (
                db.query(ScrapedModel.student_id)
                .filter(col.in_(discipline_names))
                .distinct()
                .all()
            )
            for (sid,) in rows:
                seen_ids.add(sid)

    # Também incluir alunos via enrollment
    if prof_course_ids:
        ids_from_enrollment = (
            db.query(Enrollment.student_id)
            .filter(Enrollment.course_id.in_(prof_course_ids))
            .distinct()
            .all()
        )
        for (sid,) in ids_from_enrollment:
            seen_ids.add(sid)

    student_ids = list(seen_ids)

    if not student_ids:
        return {
            "kpis": {
                "total_students": 0, "active_students": 0, "total_courses": 0,
                "average_gpa": 0.0, "average_attendance_rate": 0.0,
                "at_risk_count": 0, "pass_rate": 0.0,
            },
            "risk_summary": {"low": 0, "medium": 0, "high": 0, "critical": 0},
            "top_at_risk": [],
        }

    # Filtrar apenas ativos
    active_students = db.query(Student).filter(
        Student.id.in_(student_ids),
        Student.status == StudentStatus.ACTIVE,
    ).all()
    active_ids = [s.id for s in active_students]

    # KPIs
    gpas = [service._get_student_gpa(sid) for sid in active_ids]
    attendance_rates = [service._get_student_attendance_rate(sid) for sid in active_ids]

    # Notas dos cursos do professor
    all_grades = [g.value for g in db.query(Grade).filter(Grade.course_id.in_(prof_course_ids)).all()]

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
    for s in active_students:
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
            "total_students": len(student_ids),
            "active_students": len(active_ids),
            "total_courses": len(prof_course_ids),
            "average_gpa": avg_gpa,
            "average_attendance_rate": avg_att,
            "at_risk_count": at_risk,
            "pass_rate": pass_info.get("pass_rate", 0.0),
        },
        "risk_summary": risk_summary,
        "top_at_risk": student_risks[:10],
    }


# ═══════════════════════════════════════════════
# ENDPOINT PÚBLICO: disciplinas disponíveis (para cadastro de professor)
# ═══════════════════════════════════════════════

@router.get("/api/courses/available")
def list_available_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista disciplinas disponíveis para seleção no cadastro/perfil de professor.
    Retorna apenas disciplinas que têm dados de scraping de alunos matriculados
    nos cursos acadêmicos selecionados pelo professor.
    """
    professor = db.query(Professor).filter(Professor.user_id == current_user.id).first()
    if not professor:
        return []

    academic_course_names = [ac.course_name for ac in professor.academic_courses]
    
    if not academic_course_names:
        return []

    from app.models.scraped_data import ScrapedSubject, ScrapedGrade, ScrapedAttendance

    # Buscar disciplinas dos dados de scraping
    scraped_names = set()
    for ScrapedModel, col in [
        (ScrapedSubject, ScrapedSubject.disciplina),
        (ScrapedGrade, ScrapedGrade.disciplina),
        (ScrapedAttendance, ScrapedAttendance.disciplina),
    ]:
        rows = (
            db.query(col)
            .join(Student, Student.id == ScrapedModel.student_id)
            .filter(Student.course_name.in_(academic_course_names))
            .distinct()
            .all()
        )
        for (name,) in rows:
            if name:
                scraped_names.add(name)

    result = []
    seen = set()
    for disc_name in sorted(scraped_names):
        if disc_name.upper() not in seen:
            seen.add(disc_name.upper())
            existing = db.query(Course).filter(Course.name == disc_name).first()
            if existing:
                result.append({
                    "id": existing.id,
                    "name": existing.name,
                    "code": existing.code,
                    "department": existing.department,
                })
            else:
                result.append({
                    "id": None,
                    "name": disc_name,
                    "code": "",
                    "department": None,
                })

    return result
