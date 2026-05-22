"""
Router de autenticacao.

Endpoints para registro de usuarios, login, refresh e gerenciamento de sessoes.
"""

from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.coordinator import Coordinator
from app.models.professor import Professor, ProfessorAcademicCourse
from app.models.staff_code import StaffRegistrationCode, StaffRole
from app.models.student import ClassSchedule, Student
from app.models.user import User, UserRole
from app.models.user_session import UserSession
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    ProfessorRegisterRequest,
    RegisterRequest,
    SessionInfoResponse,
    StudentRegisterRequest,
    UserResponse,
)
from app.schemas.coordinator import CoordinatorRegisterRequest
from app.security.audit import audit_logger
from app.security.auth import (
    clear_session_cookies,
    create_access_token,
    get_current_user,
    set_refresh_cookie,
    set_session_cookie,
)
from app.security.hashing import hash_password, verify_password
from app.security.secrets import encrypt_secret
from app.security.session import (
    create_session_payload,
    create_user_session,
    generate_refresh_token,
    get_device_id,
    revoke_all_user_sessions,
    revoke_session,
    rotate_refresh_session,
    validate_refresh_session,
)

router = APIRouter(prefix="/api/auth", tags=["Autenticacao"])


def _resolve_user_for_login(identifier: str, db: Session) -> User | None:
    user = db.query(User).filter(
        (User.username == identifier)
        | (User.email == identifier)
    ).first()
    if user:
        return user

    student = db.query(Student).filter(Student.registration_number == identifier).first()
    if student:
        return student.user
    return None


def _apply_session_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    set_session_cookie(response, access_token)
    set_refresh_cookie(response, refresh_token)


def _build_access_token(user: User, session_identifier: str, access_jti: str) -> str:
    return create_access_token(
        data={
            "sub": user.username,
            "role": user.role.value,
            "sid": session_identifier,
            "jti": access_jti,
        }
    )


def _serialize_sessions(
    sessions: list[UserSession],
    current_session_identifier: str | None,
) -> list[SessionInfoResponse]:
    payload = []
    for session in sessions:
        payload.append(SessionInfoResponse(
            id=session.id,
            session_identifier=session.session_identifier,
            device_label=session.device_label,
            device_id=session.device_id,
            user_agent=session.user_agent,
            ip_address=session.ip_address,
            refresh_expires_at=session.refresh_expires_at,
            access_expires_at=session.access_expires_at,
            last_seen_at=session.last_seen_at,
            revoked_at=session.revoked_at,
            revoked_reason=session.revoked_reason,
            is_current=session.session_identifier == current_session_identifier,
        ))
    return payload


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """Registra um novo usuario no sistema."""
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username ja cadastrado")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="E-mail ja cadastrado")

    user = User(
        username=data.username,
        full_name=data.full_name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=UserRole.VIEWER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    audit_logger.log_data_change(data.username, "User", "CREATE", user.id)
    return user


@router.post("/register/student", response_model=UserResponse, status_code=201)
def register_student(data: StudentRegisterRequest, db: Session = Depends(get_db)):
    """Registra um novo aluno. Cria User + Student vinculados."""
    if db.query(User).filter(User.username == data.registration_number).first():
        raise HTTPException(status_code=400, detail="Matricula ja cadastrada como username")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="E-mail ja cadastrado")
    if db.query(Student).filter(Student.registration_number == data.registration_number).first():
        raise HTTPException(status_code=400, detail="Matricula ja cadastrada")
    if db.query(Student).filter(Student.cpf == data.cpf).first():
        raise HTTPException(status_code=400, detail="CPF ja cadastrado")

    user = User(
        username=data.registration_number,
        full_name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=UserRole.STUDENT,
        is_active=True,
        is_approved=True,
    )
    db.add(user)
    db.flush()

    schedule = None
    if data.class_schedule:
        try:
            schedule = ClassSchedule(data.class_schedule)
        except ValueError:
            schedule = None

    student = Student(
        user_id=user.id,
        name=data.name,
        age=data.age,
        cpf=data.cpf,
        gender=data.gender,
        phone=data.phone,
        email=data.email,
        registration_number=data.registration_number,
        course_name=data.course_name,
        current_period=data.current_period,
        class_schedule=schedule,
        enrollment_date=date.today(),
        is_working=data.is_working,
        work_schedule=data.work_schedule,
        lyceum_password=encrypt_secret(data.lyceum_password),
        sync_status="idle",
    )
    db.add(student)
    db.commit()
    db.refresh(user)

    audit_logger.log_data_change(user.username, "Student", "CREATE", user.id)
    return user


@router.post("/register/professor", response_model=UserResponse, status_code=201)
def register_professor(data: ProfessorRegisterRequest, db: Session = Depends(get_db)):
    """Registra um novo professor com codigo institucional valido."""
    staff_code = db.query(StaffRegistrationCode).filter(
        StaffRegistrationCode.code == data.registration_code,
        StaffRegistrationCode.role == StaffRole.PROFESSOR,
    ).first()

    if not staff_code:
        raise HTTPException(status_code=400, detail="Codigo de matricula invalido ou nao autorizado para professor")
    if staff_code.is_used:
        raise HTTPException(status_code=400, detail="Este codigo de matricula ja foi utilizado")
    if db.query(User).filter(User.username == data.registration_code).first():
        raise HTTPException(status_code=400, detail="Codigo de matricula ja cadastrado como username")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="E-mail ja cadastrado")

    user = User(
        username=data.registration_code,
        full_name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=UserRole.PROFESSOR,
        is_active=True,
        is_approved=True,
    )
    db.add(user)
    db.flush()

    professor = Professor(
        user_id=user.id,
        phone=data.phone,
    )
    db.add(professor)
    db.flush()

    for name in data.academic_course_names:
        db.add(ProfessorAcademicCourse(
            professor_id=professor.id,
            course_name=name,
        ))

    staff_code.is_used = True
    staff_code.used_by_user_id = user.id

    db.commit()
    db.refresh(user)

    audit_logger.log_data_change(data.registration_code, "Professor", "CREATE", user.id)
    return user


@router.post("/register/coordinator", response_model=UserResponse, status_code=201)
def register_coordinator(data: CoordinatorRegisterRequest, db: Session = Depends(get_db)):
    """Registra um novo coordenador com codigo institucional valido."""
    staff_code = db.query(StaffRegistrationCode).filter(
        StaffRegistrationCode.code == data.registration_code,
        StaffRegistrationCode.role == StaffRole.COORDINATOR,
    ).first()

    if not staff_code:
        raise HTTPException(status_code=400, detail="Codigo de matricula invalido ou nao autorizado para coordenador")
    if staff_code.is_used:
        raise HTTPException(status_code=400, detail="Este codigo de matricula ja foi utilizado")
    if db.query(User).filter(User.username == data.registration_code).first():
        raise HTTPException(status_code=400, detail="Username ja cadastrado")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="E-mail ja cadastrado")

    user = User(
        username=data.registration_code,
        full_name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=UserRole.COORDINATOR,
        is_active=True,
        is_approved=True,
    )
    db.add(user)
    db.flush()

    db.add(Coordinator(
        user_id=user.id,
        phone=data.phone,
        academic_course_name=data.academic_course_name,
    ))

    staff_code.is_used = True
    staff_code.used_by_user_id = user.id

    db.commit()
    db.refresh(user)

    audit_logger.log_data_change(data.registration_code, "Coordinator", "CREATE", user.id)
    return user


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    """Autentica usuario, cria sessao persistida e seta cookies de acesso e refresh."""
    identifier = data.identifier.strip()
    password = data.password.strip()

    user = _resolve_user_for_login(identifier, db)
    if not user:
        audit_logger.log_login(identifier, success=False)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais invalidas")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Conta desativada")
    if not verify_password(password, user.hashed_password):
        audit_logger.log_login(identifier, success=False)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais invalidas")

    refresh_token = generate_refresh_token()
    session_identifier, access_jti = create_session_payload(user)
    session = create_user_session(
        db=db,
        user=user,
        request=request,
        refresh_token=refresh_token,
        session_identifier=session_identifier,
        access_jti=access_jti,
    )
    access_token = _build_access_token(user, session.session_identifier, access_jti)
    _apply_session_cookies(response, access_token, refresh_token)
    db.commit()

    audit_logger.log_login(user.username, success=True)
    return LoginResponse(
        role=user.role.value,
        username=user.username,
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=LoginResponse)
def refresh_session(request: Request, response: Response, db: Session = Depends(get_db)):
    """Rotaciona refresh token e emite novo access token para a mesma sessao."""
    refresh_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    session = validate_refresh_session(db, refresh_token)
    user = db.query(User).filter(User.id == session.user_id).first()
    if not user or not user.is_active:
        revoke_session(session, "user_inactive")
        db.commit()
        clear_session_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario nao encontrado ou inativo")

    new_refresh_token = generate_refresh_token()
    _, new_access_jti = create_session_payload(user)
    rotate_refresh_session(session, request, new_refresh_token, new_access_jti)
    access_token = _build_access_token(user, session.session_identifier, new_access_jti)
    _apply_session_cookies(response, access_token, new_refresh_token)
    db.commit()

    return LoginResponse(
        role=user.role.value,
        username=user.username,
        expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    """Encerra a sessao atual removendo cookies e revogando o refresh token."""
    refresh_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if refresh_token:
        try:
            session = validate_refresh_session(db, refresh_token)
            revoke_session(session, "manual_logout")
            db.commit()
        except HTTPException:
            db.rollback()
    clear_session_cookies(response)
    response.status_code = status.HTTP_204_NO_CONTENT


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all_sessions(
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoga todas as sessoes do usuario autenticado."""
    revoke_all_user_sessions(db, current_user.id, "logout_all")
    clear_session_cookies(response)
    db.commit()
    response.status_code = status.HTTP_204_NO_CONTENT


@router.get("/sessions", response_model=List[SessionInfoResponse])
def list_sessions(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista sessoes do usuario autenticado para gestao por dispositivo."""
    current_session_id = None
    refresh_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if refresh_token:
        try:
            current_session_id = validate_refresh_session(db, refresh_token).session_identifier
        except HTTPException:
            current_session_id = None

    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == current_user.id)
        .order_by(UserSession.created_at.desc())
        .all()
    )
    return _serialize_sessions(sessions, current_session_id)


@router.delete("/sessions/{session_identifier}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_named_session(
    session_identifier: str,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoga uma sessao especifica do proprio usuario."""
    session = (
        db.query(UserSession)
        .filter(
            UserSession.user_id == current_user.id,
            UserSession.session_identifier == session_identifier,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")

    revoke_session(session, "manual_revoke")

    current_refresh_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    current_device_id = get_device_id(request)
    if current_refresh_token:
        try:
            current_session = validate_refresh_session(db, current_refresh_token)
            if current_session.session_identifier == session_identifier:
                clear_session_cookies(response)
        except HTTPException:
            clear_session_cookies(response)
    elif current_device_id and session.device_id == current_device_id:
        clear_session_cookies(response)

    db.commit()
    response.status_code = status.HTTP_204_NO_CONTENT


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Retorna dados do usuario autenticado."""
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza dados do usuario autenticado."""
    if "full_name" in data:
        full_name = str(data["full_name"] or "").strip()
        if full_name:
            current_user.full_name = full_name

    if "email" in data:
        email = str(data["email"] or "").strip().lower()
        if email and email != current_user.email:
            if db.query(User).filter(User.email == email).first():
                raise HTTPException(status_code=400, detail="E-mail ja cadastrado")
            current_user.email = email

    if "phone" in data:
        phone = str(data["phone"] or "").strip() or None
        if current_user.role == UserRole.PROFESSOR:
            prof = db.query(Professor).filter(Professor.user_id == current_user.id).first()
            if prof:
                prof.phone = phone
        elif current_user.role == UserRole.COORDINATOR:
            coord = db.query(Coordinator).filter(Coordinator.user_id == current_user.id).first()
            if coord:
                coord.phone = phone

    db.commit()
    db.refresh(current_user)
    audit_logger.log_data_change(current_user.username, "User", "UPDATE", current_user.id)
    return current_user
