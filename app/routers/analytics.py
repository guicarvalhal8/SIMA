"""
Router de Analytics — endpoints analíticos e de predição.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from app.database import get_db
from app.models.user import User, UserRole
from app.models.student import Student, StudentStatus
from app.services.analytics_service import AnalyticsService
from app.services.gemini_service import gemini_service
from app.security.auth import get_current_user
from app.security.audit import audit_logger
from fastapi import HTTPException

from app.models.professor import Professor, ProfessorCourse
from app.models.course import Course
from app.models.scraped_data import ScrapedGrade, ScrapedAttendance

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def get_professor_student_ids(db: Session, user_id: int) -> tuple:
    """
    Busca IDs de alunos que possuem dados de scraping nas disciplinas
    selecionadas pelo professor (ProfessorCourse).
    Retorna (student_ids, course_ids).
    """
    professor = db.query(Professor).filter(Professor.user_id == user_id).first()
    if not professor:
        return [], []

    # Obter nomes e IDs das disciplinas selecionadas pelo professor
    discipline_names = []
    course_ids = [pc.course_id for pc in professor.professor_courses]
    for pc in professor.professor_courses:
        course = db.query(Course).filter(Course.id == pc.course_id).first()
        if course:
            discipline_names.append(course.name)

    if not discipline_names:
        return [], course_ids

    # Buscar alunos que têm dados de scraping nessas disciplinas
    seen_ids = set()
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

    return list(seen_ids), course_ids


@router.get("/overview")
def get_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna overview completo: KPIs, distribuição de notas,
    resumo de riscos e alunos em maior risco.
    """
    audit_logger.log_access(current_user.username, "/api/analytics/overview", "GET")
    service = AnalyticsService(db)
    
    student_ids = None
    course_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, course_ids = get_professor_student_ids(db, current_user.id)
        
    return service.get_overview(student_ids=student_ids, course_ids=course_ids)


@router.get("/grades/stats")
def get_grade_stats(
    course_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Estatísticas descritivas de notas (geral ou por disciplina)."""
    audit_logger.log_access(current_user.username, "/api/analytics/grades/stats", "GET")
    service = AnalyticsService(db)
    
    student_ids = None
    course_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, course_ids = get_professor_student_ids(db, current_user.id)
        
    return service.get_grade_stats(course_id=course_id, course_ids=course_ids, student_ids=student_ids)


@router.get("/correlations")
def get_correlations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Correlações entre GPA, frequência e reprovações."""
    audit_logger.log_access(current_user.username, "/api/analytics/correlations", "GET")
    service = AnalyticsService(db)
    
    student_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, _ = get_professor_student_ids(db, current_user.id)
        
    return service.get_correlations(student_ids=student_ids)


@router.get("/pca")
def get_pca(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Análise de Componentes Principais sobre indicadores dos alunos."""
    audit_logger.log_access(current_user.username, "/api/analytics/pca", "GET")
    service = AnalyticsService(db)
    
    student_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, _ = get_professor_student_ids(db, current_user.id)
        
    return service.get_pca_analysis(student_ids=student_ids)


@router.get("/predictions")
def get_predictions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Predições de risco de evasão e recomendações por aluno."""
    audit_logger.log_access(current_user.username, "/api/analytics/predictions", "GET")
    service = AnalyticsService(db)
    
    student_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, _ = get_professor_student_ids(db, current_user.id)
        
    return service.get_predictions(student_ids=student_ids)


@router.get("/recommendations")
def get_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recomendações estratégicas para todos os alunos ativos."""
    audit_logger.log_access(current_user.username, "/api/analytics/recommendations", "GET")
    service = AnalyticsService(db)
    
    student_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, _ = get_professor_student_ids(db, current_user.id)
        
    return service.get_recommendations(student_ids=student_ids)


@router.get("/ai-insights")
async def get_ai_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gera insights usando IA (Google Gemini) sobre os dados acadêmicos."""
    audit_logger.log_access(current_user.username, "/api/analytics/ai-insights", "GET")

    service = AnalyticsService(db)
    
    student_ids = None
    course_ids = None
    if current_user.role == UserRole.PROFESSOR:
        student_ids, course_ids = get_professor_student_ids(db, current_user.id)

    # Coletar dados para alimentar o LLM
    overview = service.get_overview(student_ids=student_ids, course_ids=course_ids)
    correlations = service.get_correlations(student_ids=student_ids)
    recommendations = service.get_recommendations(student_ids=student_ids)

    kpis = overview.get("kpis", {})
    risk_students = overview.get("top_at_risk", [])

    # Chamar o Gemini
    result = await gemini_service.analyze(
        kpis=kpis,
        correlations=correlations,
        risk_students=risk_students,
        recommendations_summary={
            "total_recommendations": recommendations.get("total_recommendations", 0),
            "by_priority": recommendations.get("by_priority", {}),
        },
    )

from app.schemas.analytics import ChatRequest

@router.post("/ai-insights/chat")
async def chat_with_ai(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Endpoint para chat conversacional com a IA para professores.
    """
    if current_user.role != UserRole.PROFESSOR:
        raise HTTPException(status_code=403, detail="Acesso exclusivo para professores")

    audit_logger.log_access(current_user.username, "/api/analytics/ai-insights/chat", "POST")
    
    service = AnalyticsService(db)
    student_ids, course_ids = get_professor_student_ids(db, current_user.id)
    
    # Coletar contexto básico para a IA (mesmo dos insights)
    overview = service.get_overview(student_ids=student_ids, course_ids=course_ids)
    kpis = overview.get("kpis", {})
    risk_students = overview.get("top_at_risk", [])
    
    if request.file_content:
        response_text = await gemini_service.chat_with_file(
            message=request.message,
            file_content=request.file_content,
            kpis=kpis,
            risk_students=risk_students
        )
    else:
        response_text = await gemini_service.chat(
            message=request.message,
            kpis=kpis,
            risk_students=risk_students,
            history=request.history
        )
    
    return {"response": response_text}


@router.get("/me")
def get_my_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna overview analítico do aluno logado."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Acesso exclusivo para alunos")
    
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Perfil de aluno não encontrado")
        
    audit_logger.log_access(current_user.username, "/api/analytics/me", "GET")
    service = AnalyticsService(db)
    return service.get_student_overview(student.id)


@router.get("/me/ai-insights")
async def get_my_ai_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gera insights personalizados de IA para o aluno logado."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Acesso exclusivo para alunos")
        
    student = db.query(Student).filter(Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Perfil de aluno não encontrado")
        
    audit_logger.log_access(current_user.username, "/api/analytics/me/ai-insights", "GET")
    service = AnalyticsService(db)
    
    # Coletar dados do aluno para o LLM
    overview = service.get_student_overview(student.id)
    kpis = overview.get("kpis", {})
    recommendations = overview.get("recommendations", [])
    history = overview.get("history", [])
    student_info = overview.get("student_info", {})
    
    result = await gemini_service.analyze_student(
        student_name=student.name,
        course=student_info.get("course", ""),
        kpis=kpis,
        history=history,
        recommendations=recommendations,
    )
    
    return result

