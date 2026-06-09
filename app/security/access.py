"""
Helpers de escopo de acesso para recursos acadêmicos.
"""

from __future__ import annotations

from sqlalchemy.orm import Query, Session

from app.models.coordinator import Coordinator
from app.models.course import Course
from app.models.professor import Professor, ProfessorCourse
from app.models.student import Student
from app.models.user import User, UserRole
from app.utils.subject_name import normalize_subject_key


def can_professor_access_student(db: Session, professor_user_id: int, student: Student) -> bool:
    professor = db.query(Professor).filter(Professor.user_id == professor_user_id).first()
    if not professor:
        return False

    academic_course_names = {ac.course_name for ac in professor.academic_courses if ac.course_name}
    return bool(student.course_name and student.course_name in academic_course_names)


def can_coordinator_access_student(db: Session, coordinator_user_id: int, student: Student) -> bool:
    coordinator = db.query(Coordinator).filter(Coordinator.user_id == coordinator_user_id).first()
    if not coordinator:
        return False
    return bool(student.course_name and student.course_name == coordinator.academic_course_name)


def can_user_access_student(db: Session, current_user: User, student: Student) -> bool:
    if current_user.role in (UserRole.ADMIN, UserRole.VIEWER):
        return True
    if current_user.role == UserRole.STUDENT:
        return student.user_id == current_user.id
    if current_user.role == UserRole.PROFESSOR:
        return can_professor_access_student(db, current_user.id, student)
    if current_user.role == UserRole.COORDINATOR:
        return can_coordinator_access_student(db, current_user.id, student)
    return False


def scope_students_query(db: Session, current_user: User, query: Query) -> Query:
    if current_user.role in (UserRole.ADMIN, UserRole.VIEWER):
        return query

    if current_user.role == UserRole.STUDENT:
        return query.filter(Student.user_id == current_user.id)

    if current_user.role == UserRole.PROFESSOR:
        professor = db.query(Professor).filter(Professor.user_id == current_user.id).first()
        if not professor:
            return query.filter(Student.id == -1)
        academic_course_names = [ac.course_name for ac in professor.academic_courses if ac.course_name]
        if not academic_course_names:
            return query.filter(Student.id == -1)
        return query.filter(Student.course_name.in_(academic_course_names))

    if current_user.role == UserRole.COORDINATOR:
        coordinator = db.query(Coordinator).filter(Coordinator.user_id == current_user.id).first()
        if not coordinator or not coordinator.academic_course_name:
            return query.filter(Student.id == -1)
        return query.filter(Student.course_name == coordinator.academic_course_name)

    return query.filter(Student.id == -1)


def get_user_allowed_subject_keys(db: Session, current_user: User) -> set[str] | None:
    if current_user.role in (UserRole.ADMIN, UserRole.VIEWER, UserRole.COORDINATOR):
        return None

    if current_user.role != UserRole.PROFESSOR:
        return set()

    rows = (
        db.query(Course.name)
        .join(ProfessorCourse, ProfessorCourse.course_id == Course.id)
        .join(Professor, Professor.id == ProfessorCourse.professor_id)
        .filter(Professor.user_id == current_user.id)
        .all()
    )
    return {
        normalize_subject_key(name)
        for (name,) in rows
        if name and normalize_subject_key(name)
    }
