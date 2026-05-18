from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.user import User, UserRole
from app.models.student import Student, StudentStatus
from app.models.professor import Professor
from app.services.analytics_service import AnalyticsService
from app.services.gemini_service import gemini_service
from app.security.auth import get_current_user
from app.security.audit import audit_logger
from app.schemas.analytics import ChatRequest

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def get_professor_student_ids(db: Session, user_id: int) -> tuple[list[int] | None, list[int] | None]:
    professor = db.query(Professor).filter(Professor.user_id == user_id).first()
    if not professor:
        return [], None

    academic_course_names = [course.course_name for course in professor.academic_courses if course.course_name]
    if not academic_course_names:
        return [], None

    student_ids = [
        row[0]
        for row in db.query(Student.id)
        .filter(Student.status == StudentStatus.ACTIVE, Student.course_name.in_(academic_course_names))
        .distinct()
        .all()
    ]
    return student_ids, None


@router.get('/overview')
def get_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audit_logger.log_access(current_user.username, '/api/analytics/overview', 'GET')
    service = AnalyticsService(db)

    student_ids = None
    course_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, course_ids = get_professor_student_ids(db, current_user.id)

    return service.get_overview(student_ids=student_ids, course_ids=course_ids)


@router.get('/grades/stats')
def get_grade_stats(
    course_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audit_logger.log_access(current_user.username, '/api/analytics/grades/stats', 'GET')
    service = AnalyticsService(db)

    student_ids = None
    course_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, course_ids = get_professor_student_ids(db, current_user.id)

    return service.get_grade_stats(course_id=course_id, course_ids=course_ids, student_ids=student_ids)


@router.get('/correlations')
def get_correlations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audit_logger.log_access(current_user.username, '/api/analytics/correlations', 'GET')
    service = AnalyticsService(db)

    student_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, _ = get_professor_student_ids(db, current_user.id)

    return service.get_correlations(student_ids=student_ids)


@router.get('/pca')
def get_pca(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audit_logger.log_access(current_user.username, '/api/analytics/pca', 'GET')
    service = AnalyticsService(db)

    student_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, _ = get_professor_student_ids(db, current_user.id)

    return service.get_pca_analysis(student_ids=student_ids)


@router.get('/predictions')
def get_predictions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audit_logger.log_access(current_user.username, '/api/analytics/predictions', 'GET')
    service = AnalyticsService(db)

    student_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, _ = get_professor_student_ids(db, current_user.id)

    return service.get_predictions(student_ids=student_ids)


@router.get('/recommendations')
def get_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audit_logger.log_access(current_user.username, '/api/analytics/recommendations', 'GET')
    service = AnalyticsService(db)

    student_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, _ = get_professor_student_ids(db, current_user.id)

    return service.get_recommendations(student_ids=student_ids)


@router.get('/ai-insights')
async def get_ai_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audit_logger.log_access(current_user.username, '/api/analytics/ai-insights', 'GET')
    service = AnalyticsService(db)

    student_ids = None
    course_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, course_ids = get_professor_student_ids(db, current_user.id)

    overview = service.get_overview(student_ids=student_ids, course_ids=course_ids)
    correlations = service.get_correlations(student_ids=student_ids)
    recommendations = service.get_recommendations(student_ids=student_ids)

    result = await gemini_service.analyze(
        kpis=overview.get('kpis', {}),
        correlations=correlations,
        risk_students=overview.get('top_at_risk', []),
        recommendations_summary={
            'total_recommendations': recommendations.get('total_recommendations', 0),
            'by_priority': recommendations.get('by_priority', {}),
        },
    )
    return result


@router.post('/ai-insights/chat')
async def chat_with_ai(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.PROFESSOR:
        raise HTTPException(status_code=403, detail='Acesso exclusivo para professores')

    audit_logger.log_access(current_user.username, '/api/analytics/ai-insights/chat', 'POST')
    service = AnalyticsService(db)
    student_ids, course_ids = get_professor_student_ids(db, current_user.id)
    overview = service.get_overview(student_ids=student_ids, course_ids=course_ids)
    kpis = overview.get('kpis', {})
    risk_students = overview.get('top_at_risk', [])

    if request.file_content:
        response_text = await gemini_service.chat_with_file(
            message=request.message,
            file_content=request.file_content,
            kpis=kpis,
            risk_students=risk_students,
        )
    else:
        response_text = await gemini_service.chat(
            message=request.message,
            kpis=kpis,
            risk_students=risk_students,
            history=request.history,
        )

    return {'response': response_text}


@router.get('/me')
def get_my_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail='Acesso exclusivo para alunos')

    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail='Perfil de aluno nao encontrado')

    audit_logger.log_access(current_user.username, '/api/analytics/me', 'GET')
    service = AnalyticsService(db)
    return service.get_student_overview(student.id)


@router.get('/me/ai-insights')
async def get_my_ai_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail='Acesso exclusivo para alunos')

    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail='Perfil de aluno nao encontrado')

    audit_logger.log_access(current_user.username, '/api/analytics/me/ai-insights', 'GET')
    service = AnalyticsService(db)
    overview = service.get_student_overview(student.id)
    return await gemini_service.analyze_student_overview(overview)
