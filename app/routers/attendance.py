"""
Router CRUD de Frequência.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.attendance import Attendance
from app.models.user import User
from app.schemas.attendance import (
    AttendanceCreate, AttendanceUpdate, AttendanceResponse, AttendanceListResponse
)
from app.security.auth import get_current_user
from app.security.audit import audit_logger

router = APIRouter(prefix="/api/attendance", tags=["Frequência"])


@router.get("/", response_model=AttendanceListResponse)
def list_attendance(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    student_id: Optional[int] = None,
    course_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista registros de frequência com filtros."""
    query = db.query(Attendance)
    if student_id:
        query = query.filter(Attendance.student_id == student_id)
    if course_id:
        query = query.filter(Attendance.course_id == course_id)
    total = query.count()
    attendances = query.offset(skip).limit(limit).all()
    return AttendanceListResponse(total=total, attendances=attendances)


@router.post("/", response_model=AttendanceResponse, status_code=201)
def create_attendance(
    data: AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registra frequência de um aluno."""
    record = Attendance(**data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    audit_logger.log_data_change(current_user.username, "Attendance", "CREATE", record.id)
    return record


@router.put("/{attendance_id}", response_model=AttendanceResponse)
def update_attendance(
    attendance_id: int,
    data: AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza registro de frequência."""
    record = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro não encontrado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    audit_logger.log_data_change(current_user.username, "Attendance", "UPDATE", attendance_id)
    return record


@router.delete("/{attendance_id}", status_code=204)
def delete_attendance(
    attendance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove registro de frequência."""
    record = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    db.delete(record)
    db.commit()
    audit_logger.log_data_change(current_user.username, "Attendance", "DELETE", attendance_id)
