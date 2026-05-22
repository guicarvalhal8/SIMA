"""
Application entrypoint.

Configures FastAPI, routers and bootstrap data for local/demo usage.
"""

from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
import logging
import random

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import SessionLocal, engine
from app.models.base import Base
from app.models.student import ClassSchedule, Student, StudentStatus
from app.models.course import Course
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.grade import AssessmentType, Grade
from app.models.attendance import Attendance, AttendanceStatus
from app.models.user import User, UserRole
from app.models.professor import Professor, ProfessorCourse, ProfessorAcademicCourse
from app.models.coordinator import Coordinator
from app.models.user_session import UserSession  # noqa: F401
from app.models.staff_code import StaffRegistrationCode, StaffRole
from app.models.scraped_data import (
    ScrapedAttendance,
    ScrapedGrade,
    ScrapedSchedule,
    ScrapedSubject,
)
from app.models.historical_data import HistoricalRecord  # noqa: F401
from app.utils.attendance import normalize_attendance_record, normalize_attendance_records, resolve_attendance_percentage, resolve_total_classes
from app.routers import (
    analytics,
    attendance,
    auth,
    coordinators,
    courses,
    grades,
    historical_data,
    professors,
    students,
)
from app.security.hashing import hash_password
from app.security.secrets import encrypt_secret, is_encrypted_secret

logger = logging.getLogger(__name__)

DEMO_ACADEMIC_COURSE = "Inteligência Artificial"
DEMO_SEMESTER = "2025.1"
DEMO_COURSES = [
    {"name": "Programação I", "code": "CMP101", "credits": 4, "semester": DEMO_SEMESTER, "department": "Computação"},
    {"name": "Banco de Dados", "code": "CMP301", "credits": 4, "semester": DEMO_SEMESTER, "department": "Computação"},
    {"name": "Inteligência Artificial", "code": "CMP501", "credits": 4, "semester": DEMO_SEMESTER, "department": "Computação"},
]
DEMO_CREDENTIALS = {
    "student": {
        "username": "20249999",
        "password": "aluno123",
        "full_name": "Aluno Teste NEXORA",
        "email": "aluno.teste@nexora.edu",
        "role": UserRole.STUDENT,
    },
    "professor": {
        "username": "professor.demo",
        "password": "professor123",
        "full_name": "Professor Demo NEXORA",
        "email": "professor.demo@nexora.edu",
        "role": UserRole.PROFESSOR,
    },
    "coordinator": {
        "username": "coordenador.demo",
        "password": "coordenador123",
        "full_name": "Coordenador Demo NEXORA",
        "email": "coordenador.demo@nexora.edu",
        "role": UserRole.COORDINATOR,
    },
}


def ensure_security_tables_for_local_dev():
    """
    Garante tabelas de seguranca novas em desenvolvimento local.

    Em producao, a criacao deve ocorrer por migracao Alembic.
    """
    if settings.is_production:
        return
    UserSession.__table__.create(bind=engine, checkfirst=True)


def seed_staff_registration_codes(db):
    """Populate demo staff codes when the table is empty."""
    if db.query(StaffRegistrationCode).count() > 0:
        return

    codes = [
        StaffRegistrationCode(code="10001", role=StaffRole.COORDINATOR),
        StaffRegistrationCode(code="10002", role=StaffRole.COORDINATOR),
        StaffRegistrationCode(code="10003", role=StaffRole.COORDINATOR),
        StaffRegistrationCode(code="20001", role=StaffRole.PROFESSOR),
        StaffRegistrationCode(code="20002", role=StaffRole.PROFESSOR),
        StaffRegistrationCode(code="20003", role=StaffRole.PROFESSOR),
        StaffRegistrationCode(code="20004", role=StaffRole.PROFESSOR),
        StaffRegistrationCode(code="20005", role=StaffRole.PROFESSOR),
        StaffRegistrationCode(code="20006", role=StaffRole.PROFESSOR),
        StaffRegistrationCode(code="20007", role=StaffRole.PROFESSOR),
        StaffRegistrationCode(code="20008", role=StaffRole.PROFESSOR),
        StaffRegistrationCode(code="20009", role=StaffRole.PROFESSOR),
        StaffRegistrationCode(code="20010", role=StaffRole.PROFESSOR),
    ]

    for code in codes:
        db.add(code)
    db.commit()
    print("OK: staff registration codes created.")


def upsert_user(db, payload):
    """Create or update a known demo user and keep the password deterministic."""
    user = db.query(User).filter(User.username == payload["username"]).first()
    if not user:
        user = User(
            username=payload["username"],
            full_name=payload["full_name"],
            email=payload["email"],
            hashed_password=hash_password(payload["password"]),
            role=payload["role"],
            is_active=True,
            is_approved=True,
        )
        db.add(user)
        db.flush()
        return user

    user.full_name = payload["full_name"]
    user.email = payload["email"]
    user.role = payload["role"]
    user.is_active = True
    user.is_approved = True
    user.hashed_password = hash_password(payload["password"])
    db.flush()
    return user


def ensure_demo_courses(db):
    """Guarantee a minimal catalog for the demo roles."""
    ensured = []
    for payload in DEMO_COURSES:
        course = db.query(Course).filter(Course.code == payload["code"]).first()
        if not course:
            course = Course(**payload)
            db.add(course)
            db.flush()
        else:
            course.name = payload["name"]
            course.credits = payload["credits"]
            course.semester = payload["semester"]
            course.department = payload["department"]
            db.flush()
        ensured.append(course)
    return ensured


def ensure_demo_student_data(db, student_user, demo_courses):
    """Create a stable student profile plus grades, attendance and scraped data."""
    student = db.query(Student).filter(Student.user_id == student_user.id).first()
    if not student:
        student = Student(
            user_id=student_user.id,
            name=student_user.full_name,
            age=21,
            cpf="999.999.999-99",
            gender="Masculino",
            phone="(62) 99888-1000",
            email=student_user.email,
            registration_number=DEMO_CREDENTIALS["student"]["username"],
            course_name=DEMO_ACADEMIC_COURSE,
            current_period=4,
            class_schedule=ClassSchedule.NIGHT,
            enrollment_date=date(2025, 2, 10),
            is_working=False,
            work_schedule=None,
            lyceum_password=encrypt_secret("lyceum123"),
            sync_status="done",
            last_sync_at=datetime.utcnow(),
        )
        db.add(student)
        db.flush()
    else:
        student.name = student_user.full_name
        student.email = student_user.email
        student.phone = "(62) 99888-1000"
        student.registration_number = DEMO_CREDENTIALS["student"]["username"]
        student.course_name = DEMO_ACADEMIC_COURSE
        student.current_period = 4
        student.class_schedule = ClassSchedule.NIGHT
        student.lyceum_password = encrypt_secret("lyceum123")
        student.sync_status = "done"
        student.last_sync_at = datetime.utcnow()
        db.flush()

    db.query(ScrapedSchedule).filter(ScrapedSchedule.student_id == student.id).delete(synchronize_session=False)
    db.query(ScrapedSubject).filter(ScrapedSubject.student_id == student.id).delete(synchronize_session=False)
    db.query(ScrapedAttendance).filter(ScrapedAttendance.student_id == student.id).delete(synchronize_session=False)
    db.query(ScrapedGrade).filter(ScrapedGrade.student_id == student.id).delete(synchronize_session=False)
    db.query(Attendance).filter(Attendance.student_id == student.id).delete(synchronize_session=False)
    db.query(Grade).filter(Grade.student_id == student.id).delete(synchronize_session=False)
    db.query(Enrollment).filter(Enrollment.student_id == student.id).delete(synchronize_session=False)
    db.flush()

    grade_values = {
        "CMP101": [7.8, 8.2, 8.6],
        "CMP301": [7.2, 7.5, 7.9],
        "CMP501": [8.4, 8.8, 9.1],
    }
    attendance_values = {
        "CMP101": [AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT],
        "CMP301": [AttendanceStatus.PRESENT, AttendanceStatus.ABSENT, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT],
        "CMP501": [AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.JUSTIFIED],
    }
    schedule_meta = {
        "CMP101": {"weekday": 1, "day_name": "Segunda-feira", "start": "19:00", "end": "20:40", "room": "Lab 02"},
        "CMP301": {"weekday": 3, "day_name": "Quarta-feira", "start": "19:00", "end": "20:40", "room": "Lab 04"},
        "CMP501": {"weekday": 5, "day_name": "Sexta-feira", "start": "19:00", "end": "20:40", "room": "Sala 12"},
    }

    for course in demo_courses:
        db.add(Enrollment(
            student_id=student.id,
            course_id=course.id,
            semester=DEMO_SEMESTER,
            status=EnrollmentStatus.ENROLLED,
        ))

        for index, value in enumerate(grade_values[course.code], start=1):
            db.add(Grade(
                student_id=student.id,
                course_id=course.id,
                value=value,
                weight=0.33 if index < 3 else 0.34,
                assessment_type=AssessmentType.EXAM if index < 3 else AssessmentType.PROJECT,
                description=f"Avaliacao {index}",
            ))

        base_date = date(2025, 3, 3)
        for offset, status in enumerate(attendance_values[course.code]):
            db.add(Attendance(
                student_id=student.id,
                course_id=course.id,
                date=base_date + timedelta(days=offset * 7),
                status=status,
            ))

        average = round(sum(grade_values[course.code]) / len(grade_values[course.code]), 1)
        presences = attendance_values[course.code]
        presence_count = sum(1 for status in presences if status in (AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.JUSTIFIED))
        total_absences = sum(1 for status in presences if status == AttendanceStatus.ABSENT)
        attendance_rate = round((presence_count / len(presences)) * 100, 1)
        meta = schedule_meta[course.code]

        db.add(ScrapedSubject(
            student_id=student.id,
            disciplina=course.name,
            situacao="Matriculado",
            periodo="4o periodo",
            docente="Professor Demo NEXORA",
            data_inicial="2025-02-10",
        ))
        db.add(ScrapedGrade(
            student_id=student.id,
            disciplina=course.name,
            va1=grade_values[course.code][0],
            va2=grade_values[course.code][1],
            va3=grade_values[course.code][2],
            media=average,
            situacao="Aprovado" if average >= 6 else "Em andamento",
        ))
        db.add(ScrapedAttendance(
            student_id=student.id,
            disciplina=course.name,
            total_faltas=total_absences,
            total_aulas=len(presences),
            percentual_presenca=attendance_rate,
        ))
        db.add(ScrapedSchedule(
            student_id=student.id,
            dia_semana=meta["weekday"],
            dia_nome=meta["day_name"],
            disciplina=course.name,
            horario_inicio=meta["start"],
            horario_fim=meta["end"],
            local=meta["room"],
            professor="Professor Demo NEXORA",
        ))

    db.flush()
    return student


def ensure_demo_professor_data(db, professor_user, demo_courses):
    """Guarantee a professor profile linked to the demo catalog."""
    professor = db.query(Professor).filter(Professor.user_id == professor_user.id).first()
    if not professor:
        professor = Professor(user_id=professor_user.id, phone="(62) 99888-2000")
        db.add(professor)
        db.flush()
    else:
        professor.phone = "(62) 99888-2000"
        db.flush()

    db.query(ProfessorCourse).filter(ProfessorCourse.professor_id == professor.id).delete(synchronize_session=False)
    db.query(ProfessorAcademicCourse).filter(ProfessorAcademicCourse.professor_id == professor.id).delete(synchronize_session=False)
    db.flush()

    db.add(ProfessorAcademicCourse(professor_id=professor.id, course_name=DEMO_ACADEMIC_COURSE))
    for course in demo_courses:
        db.add(ProfessorCourse(professor_id=professor.id, course_id=course.id))

    db.flush()
    return professor


def ensure_demo_coordinator_data(db, coordinator_user):
    """Guarantee a coordinator profile for the same academic course as the demo student."""
    coordinator = db.query(Coordinator).filter(Coordinator.user_id == coordinator_user.id).first()
    if not coordinator:
        coordinator = Coordinator(
            user_id=coordinator_user.id,
            phone="(62) 99888-3000",
            academic_course_name=DEMO_ACADEMIC_COURSE,
        )
        db.add(coordinator)
    else:
        coordinator.phone = "(62) 99888-3000"
        coordinator.academic_course_name = DEMO_ACADEMIC_COURSE
    db.flush()
    return coordinator


def ensure_demo_historical_data(db, professor_user):
    """Seed a varied historical dataset for the demo professor."""
    db.query(Student).filter(
        Student.user_id.is_(None),
        Student.course_name == DEMO_ACADEMIC_COURSE,
        Student.registration_number.like("H%"),
    ).delete(synchronize_session=False)
    db.flush()

    db.query(HistoricalRecord).filter(
        HistoricalRecord.professor_id == professor_user.id
    ).delete(synchronize_session=False)
    db.flush()

    rng = random.Random(42)
    semesters = ["2024-1", "2024-2", "2025-1", "2025-2"]
    semester_bias = {"2024-1": -0.2, "2024-2": 0.1, "2025-1": 0.35, "2025-2": -0.8}
    subjects = [
        "Programacao I",
        "Programacao II",
        "Banco de Dados",
        "Redes de Computadores",
        "Eng. de Software",
        "Calculo I",
        "Estatistica",
        "Inteligencia Artificial",
    ]
    subject_bias = {
        "Programacao I": 0.1,
        "Programacao II": -0.65,
        "Banco de Dados": 0.8,
        "Redes de Computadores": -0.2,
        "Eng. de Software": 0.55,
        "Calculo I": -1.15,
        "Estatistica": -0.35,
        "Inteligencia Artificial": 1.0,
    }
    roster = [
        {"name": "Ana Silva", "profile": "good", "period": 2, "working": False},
        {"name": "Bruno Santos", "profile": "attention", "period": 2, "working": True},
        {"name": "Carla Oliveira", "profile": "critical", "period": 2, "working": True},
        {"name": "Diego Souza", "profile": "attention", "period": 2, "working": False},
        {"name": "Eduarda Ferreira", "profile": "good", "period": 2, "working": False},
        {"name": "Felipe Lima", "profile": "critical", "period": 2, "working": True},
        {"name": "Giovana Costa", "profile": "good", "period": 4, "working": False},
        {"name": "Heitor Rocha", "profile": "attention", "period": 4, "working": False},
        {"name": "Isabela Martins", "profile": "critical", "period": 4, "working": True},
        {"name": "Joao Carvalho", "profile": "attention", "period": 4, "working": False},
        {"name": "Karen Almeida", "profile": "good", "period": 4, "working": True},
        {"name": "Lucas Moraes", "profile": "critical", "period": 4, "working": False},
        {"name": "Marina Teixeira", "profile": "good", "period": 6, "working": False},
        {"name": "Nicolas Ribeiro", "profile": "attention", "period": 6, "working": True},
        {"name": "Olivia Nunes", "profile": "critical", "period": 6, "working": True},
        {"name": "Pedro Barros", "profile": "attention", "period": 6, "working": False},
        {"name": "Rafaela Gomes", "profile": "good", "period": 6, "working": False},
        {"name": "Samuel Melo", "profile": "critical", "period": 6, "working": True},
        {"name": "Tatiana Araujo", "profile": "good", "period": 8, "working": False},
        {"name": "Victor Pires", "profile": "attention", "period": 8, "working": True},
        {"name": "Wesley Duarte", "profile": "critical", "period": 8, "working": True},
        {"name": "Yasmin Prado", "profile": "good", "period": 8, "working": False},
        {"name": "Caio Rezende", "profile": "attention", "period": 8, "working": False},
        {"name": "Bianca Castro", "profile": "good", "period": 8, "working": True},
    ]
    profile_bias = {"good": 1.15, "attention": 0.0, "critical": -1.35}

    ensured_students: dict[str, Student] = {}
    next_registration = 900000

    for person in roster:
        student = db.query(Student).filter(
            Student.name == person["name"],
            Student.course_name == DEMO_ACADEMIC_COURSE,
        ).first()
        if not student:
            next_registration += 1
            safe_slug = person["name"].lower().replace(" ", ".")
            student = Student(
                user_id=None,
                name=person["name"],
                age=rng.randint(18, 31),
                cpf=None,
                gender=None,
                phone=None,
                email=f"{safe_slug}.{next_registration}@fake.edu.br",
                registration_number=f"H{next_registration}",
                course_name=DEMO_ACADEMIC_COURSE,
                current_period=person["period"],
                class_schedule=ClassSchedule.NIGHT,
                enrollment_date=date(2024, 2, 10),
                status=StudentStatus.ACTIVE,
                is_working=person["working"],
                work_schedule="08:00 as 17:00" if person["working"] else None,
                lyceum_password=None,
                sync_status="done",
                last_sync_at=datetime.utcnow(),
            )
            db.add(student)
            db.flush()
        else:
            student.current_period = person["period"]
            student.is_working = person["working"]
            student.work_schedule = "08:00 as 17:00" if person["working"] else None
            student.sync_status = "done"
            student.last_sync_at = datetime.utcnow()
            db.flush()
        ensured_students[person["name"]] = student

    def build_scores(base_value: float, profile: str) -> tuple[list[float], int]:
        center = max(1.2, min(9.7, base_value + profile_bias[profile] + rng.uniform(-0.45, 0.45)))
        first = max(0.5, min(10.0, center + rng.uniform(-1.1, 0.2 if profile == "good" else -0.1)))
        second = max(0.5, min(10.0, center + rng.uniform(-0.6, 0.6)))
        project = max(0.5, min(10.0, center + rng.uniform(-0.4, 0.9 if profile != "critical" else 0.2)))
        attendance = int(round(max(35, min(99, 78 + (base_value - 6) * 8 + profile_bias[profile] * 9 + rng.uniform(-7, 7)))))
        return [round(first, 1), round(second, 1), round(project, 1)], attendance

    for semester in semesters:
        semester_students = roster[:]
        for subject_name in subjects:
            rng.shuffle(semester_students)
            class_base = 6.1 + subject_bias[subject_name] + semester_bias[semester]
            class_size = 14 if subject_name in {"Calculo I", "Programacao II"} else 16
            chosen_students = semester_students[:class_size]

            for person in chosen_students:
                student = ensured_students[person["name"]]
                scores, attendance = build_scores(class_base, person["profile"])
                average = round(sum(scores) / len(scores), 1)

                if average >= 7.0 and attendance >= 80:
                    situation = "Aprovado"
                elif average >= 5.5 and attendance >= 70:
                    situation = "Atencao"
                else:
                    situation = "Em risco"

                db.add(HistoricalRecord(
                    semester=semester,
                    course_name=DEMO_ACADEMIC_COURSE,
                    subject=subject_name,
                    period=person["period"],
                    student_name=person["name"],
                    grades={
                        "P1": scores[0],
                        "P2": scores[1],
                        "Projeto": scores[2],
                        "SITUACAO": situation,
                    },
                    attendance=attendance,
                    professor_id=professor_user.id,
                ))

    db.flush()


def repair_scraped_attendance_data(db):
    """Normalize legacy scraped attendance rows that were saved with incorrect percentages."""
    rows = db.query(ScrapedAttendance).all()
    updated = 0

    rows_by_student = {}
    for row in rows:
        rows_by_student.setdefault(row.student_id, []).append(row)

    for student_rows in rows_by_student.values():
        normalized_attendance = normalize_attendance_records(student_rows)
        for row, attendance_payload in zip(student_rows, normalized_attendance):
            if row.total_faltas != attendance_payload["total_faltas"]:
                row.total_faltas = attendance_payload["total_faltas"]
                updated += 1

            if attendance_payload["total_aulas"] is not None and row.total_aulas != attendance_payload["total_aulas"]:
                row.total_aulas = attendance_payload["total_aulas"]
                updated += 1

            if attendance_payload["percentual_presenca"] is not None and abs((row.percentual_presenca or 0.0) - attendance_payload["percentual_presenca"]) > 0.01:
                row.percentual_presenca = attendance_payload["percentual_presenca"]
                updated += 1

    if updated:
        db.commit()
        print(f"OK: repaired {updated} scraped attendance values.")
    else:
        print("INFO: scraped attendance values already normalized.")


def migrate_legacy_sensitive_data(db):
    """Encrypt any legacy Lyceum password still stored in plain text."""
    students = db.query(Student).filter(Student.lyceum_password.isnot(None)).all()
    updated = 0

    for student in students:
        if student.lyceum_password and not is_encrypted_secret(student.lyceum_password):
            student.lyceum_password = encrypt_secret(student.lyceum_password)
            updated += 1

    if updated:
        db.commit()
        logger.warning("Encrypted %s legacy Lyceum credentials stored in plaintext.", updated)
    else:
        logger.info("No legacy Lyceum plaintext credentials found.")
def ensure_demo_credentials(db):
    """Create or refresh stable demo credentials for student, professor and coordinator."""
    demo_courses = ensure_demo_courses(db)
    student_user = upsert_user(db, DEMO_CREDENTIALS["student"])
    professor_user = upsert_user(db, DEMO_CREDENTIALS["professor"])
    coordinator_user = upsert_user(db, DEMO_CREDENTIALS["coordinator"])

    ensure_demo_student_data(db, student_user, demo_courses)
    ensure_demo_professor_data(db, professor_user, demo_courses)
    ensure_demo_coordinator_data(db, coordinator_user)
    ensure_demo_historical_data(db, professor_user)

    db.commit()
    print("OK: demo credentials ensured for student, professor and coordinator.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Bootstraps optional startup tasks."""
    if settings.AUTO_CREATE_SCHEMA:
        Base.metadata.create_all(bind=engine)
        logger.warning("AUTO_CREATE_SCHEMA is enabled. Prefer Alembic migrations outside development.")
    else:
        ensure_security_tables_for_local_dev()

    db = SessionLocal()
    try:
        seed_staff_registration_codes(db)

        if settings.CREATE_DEFAULT_ADMIN:
            admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
            if not admin:
                if not settings.DEFAULT_ADMIN_PASSWORD:
                    raise RuntimeError("CREATE_DEFAULT_ADMIN exige DEFAULT_ADMIN_PASSWORD configurada.")
                admin_user = User(
                    username=settings.DEFAULT_ADMIN_USERNAME,
                    full_name="Administrador NEXORA",
                    email=settings.DEFAULT_ADMIN_EMAIL,
                    hashed_password=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
                    role=UserRole.ADMIN,
                    is_active=True,
                    is_approved=True,
                )
                db.add(admin_user)
                db.commit()
                logger.warning("Default admin account created because CREATE_DEFAULT_ADMIN is enabled.")

        if settings.SEED_EMPTY_DATABASE and db.query(Student).count() == 0:
            from seed.generate import seed_database

            seed_database(db)
            logger.warning("Synthetic demo database seeded because SEED_EMPTY_DATABASE is enabled.")

        if settings.ENABLE_DEMO_BOOTSTRAP:
            ensure_demo_credentials(db)

        migrate_legacy_sensitive_data(db)
        if settings.ENABLE_STARTUP_DATA_REPAIR:
            repair_scraped_attendance_data(db)
    finally:
        db.close()

    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API for academic monitoring and prediction.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(students.router)
app.include_router(courses.router)
app.include_router(grades.router)
app.include_router(attendance.router)
app.include_router(analytics.router)
app.include_router(professors.router)
app.include_router(coordinators.router)
app.include_router(historical_data.router)


@app.get("/", tags=["System"])
async def root():
    return {
        "message": "Welcome to the NEXORA API. Open /docs for the documentation.",
        "version": settings.APP_VERSION,
        "docs_url": "/docs",
    }


@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "online",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }
