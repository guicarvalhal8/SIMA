"""
Router CRUD de Alunos + endpoints self-service do aluno logado.
"""

import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db, SessionLocal
from app.models.student import Student, StudentStatus
from app.models.user import User, UserRole
from app.models.scraped_data import ScrapedGrade, ScrapedAttendance, ScrapedSubject, ScrapedSchedule
from app.models.professor import Professor
from app.models.coordinator import Coordinator
from app.schemas.student import StudentCreate, StudentUpdate, StudentResponse, StudentListResponse
from app.security.auth import get_current_user
from app.security.audit import audit_logger
from app.services.analytics_service import AnalyticsService
from app.utils.attendance import resolve_attendance_percentage, resolve_total_classes

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/students", tags=["Alunos"])


def _can_professor_access_student(db: Session, professor_user_id: int, student: Student) -> bool:
    professor = db.query(Professor).filter(Professor.user_id == professor_user_id).first()
    if not professor:
        return False

    academic_course_names = {ac.course_name for ac in professor.academic_courses if ac.course_name}
    return bool(student.course_name and student.course_name in academic_course_names)


def _can_coordinator_access_student(db: Session, coordinator_user_id: int, student: Student) -> bool:
    coordinator = db.query(Coordinator).filter(Coordinator.user_id == coordinator_user_id).first()
    if not coordinator:
        return False
    return bool(student.course_name and student.course_name == coordinator.academic_course_name)


# ═══════════════════════════════════════════════
# ENDPOINTS SELF-SERVICE DO ALUNO LOGADO
# ═══════════════════════════════════════════════

@router.get("/me", response_model=StudentResponse)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna dados do aluno logado."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Acesso restrito a alunos")

    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Perfil de aluno não encontrado")
    return student


@router.patch("/me", response_model=StudentResponse)
def update_my_profile(
    data: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza dados do aluno logado."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Acesso restrito a alunos")

    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Perfil de aluno não encontrado")

    # Campos que o aluno não pode alterar via este endpoint self-service
    restricted_fields = ["registration_number", "enrollment_date", "status", "user_id", "course_name", "current_period"]
    
    update_data = data.model_dump(exclude_unset=True)
    for field in restricted_fields:
        update_data.pop(field, None)

    for field, value in update_data.items():
        setattr(student, field, value)

    # Se o e-mail mudou, atualizar também no User
    if "email" in update_data:
        current_user.email = update_data["email"]

    db.commit()
    db.refresh(student)
    audit_logger.log_data_change(current_user.username, "Student", "SELF_UPDATE", student.id)
    return student


@router.get("/me/grades")
def get_my_grades(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna notas do aluno logado, separadas por disciplina."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Acesso restrito a alunos")

    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Perfil de aluno não encontrado")

    # Buscar notas extraídas via scraping
    scraped = db.query(ScrapedGrade).filter(ScrapedGrade.student_id == student.id).all()

    grades_by_subject = []
    for g in scraped:
        grades_by_subject.append({
            "disciplina": g.disciplina,
            "va1": g.va1,
            "va2": g.va2,
            "va3": g.va3,
            "media": g.media,
            "situacao": g.situacao,
        })

    return {
        "student_id": student.id,
        "student_name": student.name,
        "total_disciplinas": len(grades_by_subject),
        "grades": grades_by_subject,
    }


@router.get("/me/attendance")
def get_my_attendance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna frequência do aluno logado, separada por disciplina."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Acesso restrito a alunos")

    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Perfil de aluno não encontrado")

    scraped = db.query(ScrapedAttendance).filter(ScrapedAttendance.student_id == student.id).all()

    attendance_by_subject = []
    for a in scraped:
        attendance_by_subject.append({
            "disciplina": a.disciplina,
            "total_faltas": a.total_faltas,
            "total_aulas": resolve_total_classes(a.total_aulas, a.total_faltas, a.percentual_presenca),
            "percentual_presenca": resolve_attendance_percentage(a.percentual_presenca, a.total_faltas, a.total_aulas),
        })

    return {
        "student_id": student.id,
        "student_name": student.name,
        "total_disciplinas": len(attendance_by_subject),
        "attendance": attendance_by_subject,
    }


@router.get("/me/subjects")
def get_my_subjects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna disciplinas matriculadas do aluno logado."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Acesso restrito a alunos")

    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Perfil de aluno não encontrado")

    scraped = db.query(ScrapedSubject).filter(ScrapedSubject.student_id == student.id).all()

    subjects = []
    for s in scraped:
        subjects.append({
            "disciplina": s.disciplina,
            "situacao": s.situacao,
            "periodo": s.periodo,
            "docente": s.docente,
            "data_inicial": s.data_inicial,
        })

    return {
        "student_id": student.id,
        "student_name": student.name,
        "total_disciplinas": len(subjects),
        "subjects": subjects,
    }


@router.get("/me/schedule")
def get_my_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna horários do aluno logado."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Acesso restrito a alunos")

    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Perfil de aluno não encontrado")

    scraped = db.query(ScrapedSchedule).filter(ScrapedSchedule.student_id == student.id).all()

    schedule = []
    for s in scraped:
        schedule.append({
            "dia_semana": s.dia_semana,
            "dia_nome": s.dia_nome,
            "disciplina": s.disciplina,
            "horario_inicio": s.horario_inicio,
            "horario_fim": s.horario_fim,
            "local": s.local,
            "professor": s.professor,
        })

    # Ordenar por dia da semana e horário
    schedule.sort(key=lambda x: (x["dia_semana"], x.get("horario_inicio", "")))

    return {
        "student_id": student.id,
        "student_name": student.name,
        "total_aulas": len(schedule),
        "schedule": schedule,
    }


# ═══════════════════════════════════════════════
# SINCRONIZAÇÃO LYCEUM
# ═══════════════════════════════════════════════

def _run_sync_background(student_id: int, registration_number: str, cpf: str, custom_password: str = None):
    """
    Executa o scraping do Lyceum em uma thread separada.
    Tenta login com matrícula + senhas derivadas do CPF (fallback para senha personalizada).
    Cria sua própria sessão de DB para evitar problemas de threading.
    """
    db = SessionLocal()
    try:
        from app.services.scraper_service import scraper_service

        # Marcar como syncing
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            return
        student.sync_status = "syncing"
        student.sync_error = None
        db.commit()

        # Executar scraping completo com tentativas de senha
        result = scraper_service.run_full_scrape(
            student_id, registration_number, cpf, custom_password, db
        )

        # Atualizar status
        student = db.query(Student).filter(Student.id == student_id).first()
        if result.get("success"):
            student.sync_status = "done"
            student.last_sync_at = datetime.utcnow()
            student.sync_error = None
            logger.info(f"✅ Sync completo para student_id={student_id}: "
                        f"{result['grades_count']} notas, {result['attendance_count']} frequências, "
                        f"{result['subjects_count']} disciplinas, {result['schedule_count']} horários")
        else:
            student.sync_status = "error"
            student.sync_error = "; ".join(result.get("errors", ["Erro desconhecido"]))
            logger.error(f"❌ Sync falhou para student_id={student_id}: {student.sync_error}")

        db.commit()

    except Exception as e:
        logger.error(f"❌ Exceção no sync background: {e}")
        try:
            student = db.query(Student).filter(Student.id == student_id).first()
            if student:
                student.sync_status = "error"
                student.sync_error = str(e)[:500]
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.post("/me/sync")
def start_sync(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Inicia sincronização dos dados do Lyceum para o aluno logado."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Acesso restrito a alunos")

    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Perfil de aluno não encontrado")

    # Verificar se já está sincronizando
    if student.sync_status == "syncing":
        raise HTTPException(status_code=409, detail="Sincronização já em andamento")

    # Verificar se tem CPF (necessário para derivar a senha)
    if not student.cpf:
        raise HTTPException(
            status_code=400,
            detail="CPF é necessário para sincronizar. Atualize seu perfil.",
        )

    if not student.registration_number:
        raise HTTPException(
            status_code=400,
            detail="Matrícula é necessária para sincronizar.",
        )

    # Marcar como syncing imediatamente
    student.sync_status = "syncing"
    student.sync_error = None
    db.commit()

    # Executar em background — tenta CPF-based passwords + custom password se tiver
    background_tasks.add_task(
        _run_sync_background,
        student.id,
        student.registration_number,
        student.cpf,
        student.lyceum_password,  # None se não tiver alterado
    )

    return {
        "message": "Sincronização iniciada",
        "sync_status": "syncing",
    }


@router.get("/me/sync-status")
def get_sync_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna o status da sincronização Lyceum do aluno logado."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Acesso restrito a alunos")

    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Perfil de aluno não encontrado")

    return {
        "sync_status": student.sync_status,
        "last_sync_at": student.last_sync_at.isoformat() if student.last_sync_at else None,
        "sync_error": student.sync_error,
        "has_lyceum_credentials": bool(student.cpf and student.registration_number),
    }


@router.post("/me/lyceum-credentials")
def update_lyceum_credentials(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza as credenciais do Lyceum do aluno (caso não tenha informado no cadastro)."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Acesso restrito a alunos")

    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Perfil de aluno não encontrado")

    password = data.get("lyceum_password")
    if not password:
        raise HTTPException(status_code=400, detail="Senha do portal é obrigatória")

    student.lyceum_password = password
    db.commit()

    return {"message": "Credenciais do Lyceum atualizadas com sucesso"}


# ═══════════════════════════════════════════════
# ENDPOINTS CRUD (admin/coordenador/professor)
# ═══════════════════════════════════════════════

@router.get("/", response_model=StudentListResponse)
def list_students(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista alunos com paginação e filtros opcionais."""
    from app.models.professor import Professor
    from app.models.enrollment import Enrollment

    query = db.query(Student)

    if current_user.role == UserRole.PROFESSOR:
        professor = db.query(Professor).filter(Professor.user_id == current_user.id).first()
        if not professor:
            return StudentListResponse(total=0, students=[])

        academic_course_names = [ac.course_name for ac in professor.academic_courses if ac.course_name]
        if not academic_course_names:
            return StudentListResponse(total=0, students=[])

        query = query.filter(
            Student.status == StudentStatus.ACTIVE,
            Student.course_name.in_(academic_course_names),
        )

    if status:
        query = query.filter(Student.status == StudentStatus(status))
    if search:
        query = query.filter(
            Student.name.ilike(f"%{search}%") |
            Student.registration_number.ilike(f"%{search}%")
        )
    total = query.count()
    students = query.offset(skip).limit(limit).all()
    return StudentListResponse(total=total, students=students)


@router.get("/{student_id}", response_model=StudentResponse)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna dados de um aluno específico."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    return student


@router.get("/{student_id}/detail")
def get_student_detail(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna detalhes completos de um aluno para professor, coordenador ou administrador."""
    if current_user.role not in (UserRole.PROFESSOR, UserRole.COORDINATOR, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Acesso restrito a professor, coordenacao e administracao")

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")

    if current_user.role == UserRole.PROFESSOR and not _can_professor_access_student(db, current_user.id, student):
        raise HTTPException(status_code=403, detail="Voce nao tem acesso a este aluno")

    if current_user.role == UserRole.COORDINATOR and not _can_coordinator_access_student(db, current_user.id, student):
        raise HTTPException(status_code=403, detail="Voce nao tem acesso a este aluno")

    # Notas scraped
    scraped_grades = db.query(ScrapedGrade).filter(ScrapedGrade.student_id == student.id).all()
    grades = [
        {
            "disciplina": g.disciplina,
            "va1": g.va1,
            "va2": g.va2,
            "va3": g.va3,
            "media": g.media,
            "situacao": g.situacao,
        }
        for g in scraped_grades
    ]

    # Frequência scraped
    scraped_att = db.query(ScrapedAttendance).filter(ScrapedAttendance.student_id == student.id).all()
    attendance = [
        {
            "disciplina": a.disciplina,
            "total_faltas": a.total_faltas,
            "total_aulas": resolve_total_classes(a.total_aulas, a.total_faltas, a.percentual_presenca),
            "percentual_presenca": resolve_attendance_percentage(a.percentual_presenca, a.total_faltas, a.total_aulas),
        }
        for a in scraped_att
    ]

    scraped_subjects = db.query(ScrapedSubject).filter(ScrapedSubject.student_id == student.id).all()
    subjects = [
        {
            "disciplina": s.disciplina,
            "situacao": s.situacao,
            "periodo": s.periodo,
            "docente": s.docente,
            "data_inicial": s.data_inicial,
        }
        for s in scraped_subjects
    ]

    scraped_schedule = db.query(ScrapedSchedule).filter(ScrapedSchedule.student_id == student.id).all()
    schedule = [
        {
            "dia_semana": s.dia_semana,
            "dia_nome": s.dia_nome,
            "disciplina": s.disciplina,
            "horario_inicio": s.horario_inicio,
            "horario_fim": s.horario_fim,
            "local": s.local,
            "professor": s.professor,
        }
        for s in scraped_schedule
    ]
    schedule.sort(key=lambda item: (item.get("dia_semana") or 99, item.get("horario_inicio") or ""))

    analytics = AnalyticsService(db).get_student_overview(student.id)

    return {
        "student": {
            "id": student.id,
            "name": student.name,
            "email": student.email,
            "phone": student.phone,
            "age": student.age,
            "gender": student.gender,
            "cpf": student.cpf,
            "registration_number": student.registration_number,
            "course_name": student.course_name,
            "current_period": student.current_period,
            "class_schedule": student.class_schedule.value if student.class_schedule and hasattr(student.class_schedule, "value") else (student.class_schedule if isinstance(student.class_schedule, str) else None),
            "status": student.status.value if student.status else None,
            "enrollment_date": student.enrollment_date.isoformat() if student.enrollment_date else None,
            "is_working": bool(student.is_working),
            "work_schedule": student.work_schedule,
            "sync_status": student.sync_status,
            "last_sync_at": student.last_sync_at.isoformat() if student.last_sync_at else None,
        },
        "analytics": analytics,
        "grades": grades,
        "attendance": attendance,
        "subjects": subjects,
        "schedule": schedule,
    }


@router.post("/", response_model=StudentResponse, status_code=201)
def create_student(
    data: StudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cria um novo aluno."""
    if db.query(Student).filter(Student.registration_number == data.registration_number).first():
        raise HTTPException(status_code=400, detail="Matrícula já cadastrada")

    student = Student(**data.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)
    audit_logger.log_data_change(current_user.username, "Student", "CREATE", student.id)
    return student


@router.put("/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: int,
    data: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza dados de um aluno."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(student, field, value)

    db.commit()
    db.refresh(student)
    audit_logger.log_data_change(current_user.username, "Student", "UPDATE", student.id)
    return student


@router.delete("/{student_id}", status_code=204)
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove um aluno."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")

    db.delete(student)
    db.commit()
    audit_logger.log_data_change(current_user.username, "Student", "DELETE", student_id)
