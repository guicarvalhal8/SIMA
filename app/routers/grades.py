"""
Router CRUD de Notas.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.grade import Grade
from app.models.user import User
from app.schemas.grade import GradeCreate, GradeUpdate, GradeResponse, GradeListResponse
from app.security.auth import get_current_user
from app.security.audit import audit_logger

router = APIRouter(prefix="/api/grades", tags=["Notas"])


@router.get("/", response_model=GradeListResponse)
def list_grades(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    student_id: Optional[int] = None,
    course_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista notas com filtros por aluno e/ou disciplina."""
    query = db.query(Grade)
    if student_id:
        query = query.filter(Grade.student_id == student_id)
    if course_id:
        query = query.filter(Grade.course_id == course_id)
    total = query.count()
    grades = query.offset(skip).limit(limit).all()
    return GradeListResponse(total=total, grades=grades)


@router.post("/", response_model=GradeResponse, status_code=201)
def create_grade(
    data: GradeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registra uma nova nota."""
    grade = Grade(**data.model_dump())
    db.add(grade)
    db.commit()
    db.refresh(grade)
    audit_logger.log_data_change(current_user.username, "Grade", "CREATE", grade.id)
    return grade


@router.put("/{grade_id}", response_model=GradeResponse)
def update_grade(
    grade_id: int,
    data: GradeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza uma nota."""
    grade = db.query(Grade).filter(Grade.id == grade_id).first()
    if not grade:
        raise HTTPException(status_code=404, detail="Nota não encontrada")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(grade, field, value)

    db.commit()
    db.refresh(grade)
    audit_logger.log_data_change(current_user.username, "Grade", "UPDATE", grade.id)
    return grade


@router.delete("/{grade_id}", status_code=204)
def delete_grade(
    grade_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove uma nota."""
    grade = db.query(Grade).filter(Grade.id == grade_id).first()
    if not grade:
        raise HTTPException(status_code=404, detail="Nota não encontrada")
    db.delete(grade)
    db.commit()
    audit_logger.log_data_change(current_user.username, "Grade", "DELETE", grade_id)
