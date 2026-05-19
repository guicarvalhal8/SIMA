"""
Router CRUD de Disciplinas.
"""

import unicodedata
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.student import Student
from app.models.user import User
from app.schemas.course import CourseCreate, CourseUpdate, CourseResponse, CourseListResponse
from app.security.auth import get_current_user
from app.security.audit import audit_logger

router = APIRouter(prefix="/api/courses", tags=["Disciplinas"])

ACADEMIC_COURSE_FALLBACK = [
    "Administracao",
    "Agronomia",
    "Analise e Desenvolvimento de Sistemas",
    "Arquitetura e Urbanismo",
    "Biomedicina",
    "Ciencias Contabeis",
    "Comunicacao Social: Publicidade e Propaganda",
    "Design Grafico",
    "Direito",
    "Educacao Fisica",
    "Enfermagem",
    "Engenharia Civil",
    "Engenharia de Software",
    "Engenharia Eletrica",
    "Engenharia Mecanica",
    "Estetica e Cosmetica",
    "Farmacia",
    "Fisioterapia",
    "Gastronomia",
    "Inteligencia Artificial",
    "Medicina",
    "Medicina Veterinaria",
    "Nutricao",
    "Odontologia",
    "Psicologia",
    "Relacoes Internacionais",
]

CATALOG_FALLBACK_RULES = [
    {
        "matches": {
            "inteligencia artificial",
            "analise e desenvolvimento de sistemas",
            "engenharia de software",
            "design grafico",
        },
        "departments": {"Computacao", "Matematica"},
        "keywords": {"programacao", "banco", "software", "inteligencia", "algorit", "estatistica"},
    },
    {
        "matches": {
            "engenharia civil",
            "engenharia eletrica",
            "engenharia mecanica",
            "arquitetura e urbanismo",
        },
        "departments": {"Fisica", "Matematica", "Computacao"},
        "keywords": {"calculo", "fisica", "algebra", "estatistica", "redes"},
    },
]


def normalize_text(value: Optional[str]) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(char for char in normalized if not unicodedata.combining(char)).lower().strip()


def unique_texts(values: list[str]) -> list[str]:
    unique_values: dict[str, str] = {}
    for value in values:
        cleaned = str(value or "").strip()
        normalized = normalize_text(cleaned)
        if cleaned and normalized not in unique_values:
            unique_values[normalized] = cleaned
    return sorted(unique_values.values(), key=lambda item: item.lower())


def serialize_course(course: Course) -> dict:
    return {
        "id": course.id,
        "name": course.name,
        "code": course.code,
        "department": course.department,
    }


def infer_catalog_courses(db: Session, academic_names: list[str]) -> list[dict]:
    """Usa o catalogo institucional como fallback quando nao ha vinculo explicito suficiente."""
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

        if normalize_text(course.department) in {normalize_text(item) for item in inferred_departments}:
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
    """Retorna a lista de cursos academicos unicos do banco, com fallback institucional."""
    database_courses = [
        value[0]
        for value in (
            db.query(Student.course_name)
            .filter(Student.course_name.isnot(None), Student.course_name != "")
            .distinct()
            .all()
        )
        if value[0]
    ]
    return unique_texts([*database_courses, *ACADEMIC_COURSE_FALLBACK])


@router.get("/by-academic-courses")
def list_subjects_by_academic_courses(
    names: str = Query(...),
    db: Session = Depends(get_db),
):
    """Retorna disciplinas ligadas aos cursos academicos informados."""

    academic_names = unique_texts([name for name in names.split(",") if name.strip()])
    if not academic_names:
        return []

    result = []
    seen_ids = set()
    seen_names = set()
    normalized_academic_names = {normalize_text(name) for name in academic_names}

    from app.models.scraped_data import ScrapedSubject, ScrapedGrade, ScrapedAttendance

    scraped_names = set()

    for scraped_model, column in [
        (ScrapedSubject, ScrapedSubject.disciplina),
        (ScrapedGrade, ScrapedGrade.disciplina),
        (ScrapedAttendance, ScrapedAttendance.disciplina),
    ]:
        rows = (
            db.query(column)
            .join(Student, Student.id == scraped_model.student_id)
            .filter(Student.course_name.in_(academic_names))
            .distinct()
            .all()
        )
        for (name,) in rows:
            if name:
                scraped_names.add(name)

    catalog_courses = db.query(Course).all()
    catalog_by_normalized_name = {
        normalize_text(course.name): course
        for course in catalog_courses
        if course.name
    }

    for disc_name in sorted(scraped_names, key=lambda item: item.lower()):
        normalized_disc_name = normalize_text(disc_name)
        if normalized_disc_name in seen_names:
            continue

        seen_names.add(normalized_disc_name)
        existing = catalog_by_normalized_name.get(normalized_disc_name)
        if existing:
            seen_ids.add(existing.id)
            result.append(serialize_course(existing))
        else:
            result.append({
                "id": None,
                "name": disc_name.strip(),
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
        normalized_name = normalize_text(course.name)
        if course.id not in seen_ids and normalized_name not in seen_names:
            seen_ids.add(course.id)
            seen_names.add(normalized_name)
            result.append(serialize_course(course))

    if not result:
        result.extend(infer_catalog_courses(db, academic_names))

    result.sort(key=lambda item: normalize_text(item["name"]))
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
    """Lista disciplinas com paginacao e filtros."""
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
        raise HTTPException(status_code=404, detail="Disciplina nao encontrada")
    return course


@router.post("/", response_model=CourseResponse, status_code=201)
def create_course(
    data: CourseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cria uma nova disciplina."""
    if db.query(Course).filter(Course.code == data.code).first():
        raise HTTPException(status_code=400, detail="Codigo de disciplina ja cadastrado")

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
        raise HTTPException(status_code=404, detail="Disciplina nao encontrada")

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
        raise HTTPException(status_code=404, detail="Disciplina nao encontrada")

    db.delete(course)
    db.commit()
    audit_logger.log_data_change(current_user.username, "Course", "DELETE", course_id)
