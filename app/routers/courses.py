"""
Router CRUD de Disciplinas.
"""

import unicodedata
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.course import Course
from app.models.user import User
from app.schemas.course import CourseCreate, CourseUpdate, CourseResponse, CourseListResponse
from app.security.auth import get_current_user
from app.models.student import Student
from app.models.enrollment import Enrollment

router = APIRouter(prefix="/api/courses", tags=["Disciplinas"])


CATALOG_FALLBACK_RULES = [
    {
        "matches": {
            "inteligencia artificial",
            "analise e desenvolvimento de sistemas",
            "engenharia de software",
            "design grafico",
        },
        "departments": {"Computação", "Matemática"},
        "keywords": {"programacao", "banco", "software", "inteligencia", "algorit", "estatistica"},
    },
    {
        "matches": {
            "engenharia civil",
            "engenharia eletrica",
            "engenharia mecanica",
            "arquitetura e urbanismo",
        },
        "departments": {"Física", "Matemática", "Computação"},
        "keywords": {"calculo", "fisica", "algebra", "estatistica", "redes"},
    },
]


def normalize_text(value: Optional[str]) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(char for char in normalized if not unicodedata.combining(char)).lower().strip()


def serialize_course(course: Course) -> dict:
    return {
        "id": course.id,
        "name": course.name,
        "code": course.code,
        "department": course.department,
    }


def infer_catalog_courses(db: Session, academic_names: list[str]) -> list[dict]:
    """Usa o catálogo institucional como fallback quando não há vínculo explícito suficiente."""
    normalized_names = [normalize_text(name) for name in academic_names]
    inferred_departments = set()
    inferred_keywords = set()

    for rule in CATALOG_FALLBACK_RULES:
        if any(name in rule["matches"] for name in normalized_names):
            inferred_departments.update(rule["departments"])
            inferred_keywords.update(rule["keywords"])

    catalog = db.query(Course).all()
    ranked_courses: list[tuple[int, str, Course]] = []

    for course in catalog:
        course_name = normalize_text(course.name)
        course_department = normalize_text(course.department)
        course_code = normalize_text(course.code)
        score = 0

        if course.department in inferred_departments:
            score += 3
        if any(keyword in course_name or keyword in course_department or keyword in course_code for keyword in inferred_keywords):
            score += 2

        ranked_courses.append((score, course.name, course))

    ranked_courses.sort(key=lambda item: (-item[0], item[1]))

    prioritized = [serialize_course(course) for score, _, course in ranked_courses if score > 0]
    if prioritized:
        return prioritized

    return [serialize_course(course) for _, _, course in ranked_courses]


@router.get("/academic-courses")
def list_available_academic_courses(
    db: Session = Depends(get_db),
):
    """Retorna a lista de nomes de cursos únicos presentes no banco de estudantes."""
    courses = (
        db.query(Student.course_name)
        .filter(Student.course_name != None, Student.course_name != "")
        .distinct()
        .all()
    )
    return [c[0] for c in courses]


@router.get("/by-academic-courses")
def list_subjects_by_academic_courses(
    names: str = Query(...), # Comma separated list of academic course names
    db: Session = Depends(get_db),
):
    """Retorna disciplinas (matérias) ligadas aos cursos acadêmicos informados.
    
    Usa dados de scraping como fonte principal (scraped_grades, scraped_attendance, scraped_subjects).
    Apenas disciplinas que possuem dados reais de alunos matriculados nos cursos acadêmicos
    informados são retornadas.
    """

    academic_names = [n.strip() for n in names.split(",") if n.strip()]
    if not academic_names:
        return []

    result = []
    seen_ids = set()
    seen_names = set()

    # Buscar disciplinas a partir dos dados de scraping (fonte principal)
    from app.models.scraped_data import ScrapedSubject, ScrapedGrade, ScrapedAttendance

    scraped_names = set()

    for ScrapedModel, col in [
        (ScrapedSubject, ScrapedSubject.disciplina),
        (ScrapedGrade, ScrapedGrade.disciplina),
        (ScrapedAttendance, ScrapedAttendance.disciplina),
    ]:
        rows = (
            db.query(col)
            .join(Student, Student.id == ScrapedModel.student_id)
            .filter(Student.course_name.in_(academic_names))
            .distinct()
            .all()
        )
        for (name,) in rows:
            if name:
                scraped_names.add(name)

    for disc_name in sorted(scraped_names):
        if disc_name.upper() not in seen_names:
            seen_names.add(disc_name.upper())
            # Tentar encontrar na tabela courses por nome
            existing = db.query(Course).filter(Course.name == disc_name).first()
            if existing:
                seen_ids.add(existing.id)
                result.append(serialize_course(existing))
            else:
                result.append({
                    "id": None,
                    "name": disc_name,
                    "code": "",
                    "department": None,
                })

    enrolled_courses = (
        db.query(Course)
        .join(Enrollment, Enrollment.course_id == Course.id)
        .join(Student, Student.id == Enrollment.student_id)
        .filter(Student.course_name.in_(academic_names))
        .distinct()
        .all()
    )
    for course in enrolled_courses:
        if course.id not in seen_ids:
            seen_ids.add(course.id)
            result.append(serialize_course(course))

    if not result:
        result.extend(infer_catalog_courses(db, academic_names))

    # Ordenar por nome
    result.sort(key=lambda x: x["name"])

    return result


@router.get("/", response_model=CourseListResponse)
def list_courses(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    department: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista disciplinas com paginação e filtros."""
    query = db.query(Course)
    if department:
        query = query.filter(Course.department == department)
    if search:
        query = query.filter(
            Course.name.ilike(f"%{search}%") |
            Course.code.ilike(f"%{search}%")
        )
    total = query.count()
    courses = query.offset(skip).limit(limit).all()
    return CourseListResponse(total=total, courses=courses)


@router.get("/{course_id:int}", response_model=CourseResponse)
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna dados de uma disciplina."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Disciplina não encontrada")
    return course


@router.post("/", response_model=CourseResponse, status_code=201)
def create_course(
    data: CourseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cria uma nova disciplina."""
    if db.query(Course).filter(Course.code == data.code).first():
        raise HTTPException(status_code=400, detail="Código de disciplina já cadastrado")

    course = Course(**data.model_dump())
    db.add(course)
    db.commit()
    db.refresh(course)
    audit_logger.log_data_change(current_user.username, "Course", "CREATE", course.id)
    return course


@router.put("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int,
    data: CourseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza dados de uma disciplina."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Disciplina não encontrada")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(course, field, value)

    db.commit()
    db.refresh(course)
    audit_logger.log_data_change(current_user.username, "Course", "UPDATE", course.id)
    return course


@router.delete("/{course_id}", status_code=204)
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove uma disciplina."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Disciplina não encontrada")

    db.delete(course)
    db.commit()
    audit_logger.log_data_change(current_user.username, "Course", "DELETE", course_id)
