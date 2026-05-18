"""
Router de autenticação.

Endpoints para registro de usuários (aluno, professor, coordenador) e login com JWT.
Registro de professores e coordenadores requer código de matrícula válido.
"""

from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.student import Student, ClassSchedule
from app.models.professor import Professor, ProfessorAcademicCourse
from app.models.coordinator import Coordinator
from app.models.staff_code import StaffRegistrationCode, StaffRole
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    StudentRegisterRequest,
    ProfessorRegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.schemas.coordinator import CoordinatorRegisterRequest
from app.security.hashing import hash_password, verify_password
from app.security.auth import create_access_token, get_current_user
from app.security.audit import audit_logger

router = APIRouter(prefix="/api/auth", tags=["Autenticação"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """Registra um novo usuário no sistema (genérico)."""
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username já cadastrado")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    user = User(
        username=data.username,
        full_name=data.full_name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=UserRole(data.role) if data.role in [r.value for r in UserRole] else UserRole.VIEWER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    audit_logger.log_data_change(data.username, "User", "CREATE", user.id)
    return user


@router.post("/register/student", response_model=UserResponse, status_code=201)
def register_student(data: StudentRegisterRequest, db: Session = Depends(get_db)):
    """Registra um novo aluno. Cria User + Student vinculados."""
    # Verificar duplicatas
    if db.query(User).filter(User.username == data.registration_number).first():
        raise HTTPException(status_code=400, detail="Matrícula já cadastrada como username")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    if db.query(Student).filter(Student.registration_number == data.registration_number).first():
        raise HTTPException(status_code=400, detail="Matrícula já cadastrada")
    if db.query(Student).filter(Student.cpf == data.cpf).first():
        raise HTTPException(status_code=400, detail="CPF já cadastrado")

    # Criar User (username = matrícula por padrão)
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
    db.flush()  # Para obter o user.id

    # Resolver class_schedule enum
    schedule = None
    if data.class_schedule:
        try:
            schedule = ClassSchedule(data.class_schedule)
        except ValueError:
            pass

    # Criar Student vinculado
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
        lyceum_password=data.lyceum_password,
        sync_status="idle",
    )
    db.add(student)
    db.commit()
    db.refresh(user)

    audit_logger.log_data_change(user.username, "Student", "CREATE", user.id)
    return user


@router.post("/register/professor", response_model=UserResponse, status_code=201)
def register_professor(data: ProfessorRegisterRequest, db: Session = Depends(get_db)):
    """
    Registra um novo professor.
    Requer código de matrícula válido para PROFESSOR.
    A conta fica ativa imediatamente após validação do código.
    """
    # Validar código de matrícula
    staff_code = db.query(StaffRegistrationCode).filter(
        StaffRegistrationCode.code == data.registration_code,
        StaffRegistrationCode.role == StaffRole.PROFESSOR,
    ).first()

    if not staff_code:
        raise HTTPException(
            status_code=400,
            detail="Código de matrícula inválido ou não autorizado para professor",
        )
    if staff_code.is_used:
        raise HTTPException(
            status_code=400,
            detail="Este código de matrícula já foi utilizado",
        )

    if db.query(User).filter(User.username == data.registration_code).first():
        raise HTTPException(status_code=400, detail="Código de matrícula já cadastrado como username")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    # Criar User com is_approved=True (aprovação automática via código)
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

    # Criar Professor
    professor = Professor(
        user_id=user.id,
        phone=data.phone,
    )
    db.add(professor)
    db.flush()

    # Associar cursos acadêmicos (IA, Nutrição, etc)
    for name in data.academic_course_names:
        pac = ProfessorAcademicCourse(
            professor_id=professor.id,
            course_name=name,
        )
        db.add(pac)

    # Marcar código como usado
    staff_code.is_used = True
    staff_code.used_by_user_id = user.id

    db.commit()
    db.refresh(user)

    audit_logger.log_data_change(data.registration_code, "Professor", "CREATE", user.id)
    return user


@router.post("/register/coordinator", response_model=UserResponse, status_code=201)
def register_coordinator(data: CoordinatorRegisterRequest, db: Session = Depends(get_db)):
    """
    Registra um novo coordenador.
    Requer código de matrícula válido para COORDINATOR.
    A conta fica ativa imediatamente após validação do código.
    """
    # Validar código de matrícula
    staff_code = db.query(StaffRegistrationCode).filter(
        StaffRegistrationCode.code == data.registration_code,
        StaffRegistrationCode.role == StaffRole.COORDINATOR,
    ).first()

    if not staff_code:
        raise HTTPException(
            status_code=400,
            detail="Código de matrícula inválido ou não autorizado para coordenador",
        )
    if staff_code.is_used:
        raise HTTPException(
            status_code=400,
            detail="Este código de matrícula já foi utilizado",
        )

    # Usar o código de matrícula como username
    username = data.registration_code

    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Username já cadastrado")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    # Criar User
    user = User(
        username=username,
        full_name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=UserRole.COORDINATOR,
        is_active=True,
        is_approved=True,
    )
    db.add(user)
    db.flush()

    # Criar Coordinator
    coordinator = Coordinator(
        user_id=user.id,
        phone=data.phone,
        academic_course_name=data.academic_course_name,
    )
    db.add(coordinator)

    # Marcar código como usado
    staff_code.is_used = True
    staff_code.used_by_user_id = user.id

    db.commit()
    db.refresh(user)

    audit_logger.log_data_change(username, "Coordinator", "CREATE", user.id)
    return user


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """Autentica usuário e retorna token JWT."""
    # Trimar campos para evitar erro de espaço invisível
    data.identifier = data.identifier.strip()
    data.password = data.password.strip()

    # Buscar por username ou email
    user = db.query(User).filter(
        (User.username == data.identifier) | 
        (User.email == data.identifier)
    ).first()

    # Se não encontrar, buscar por matrícula (estudante)
    if not user:
        student = db.query(Student).filter(Student.registration_number == data.identifier).first()
        if student:
            user = student.user

    if not user:
        audit_logger.log_login(data.identifier, success=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Conta desativada")

    if not verify_password(data.password, user.hashed_password):
        audit_logger.log_login(data.identifier, success=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
        )

    token = create_access_token(data={"sub": user.username, "role": user.role.value})
    audit_logger.log_login(user.username, success=True)

    return TokenResponse(
        access_token=token,
        role=user.role.value,
        username=user.username,
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Retorna dados do usuário autenticado."""
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza dados do usuário autenticado."""
    if "full_name" in data:
        current_user.full_name = data["full_name"]
    if "email" in data:
        # Verificar se email já existe
        if data["email"] != current_user.email:
            if db.query(User).filter(User.email == data["email"]).first():
                raise HTTPException(status_code=400, detail="E-mail já cadastrado")
            current_user.email = data["email"]
    
    # Atualizar phone no modelo Professor/Coordinator se aplicável
    if "phone" in data:
        from app.models.professor import Professor
        from app.models.coordinator import Coordinator
        if current_user.role == UserRole.PROFESSOR:
            prof = db.query(Professor).filter(Professor.user_id == current_user.id).first()
            if prof:
                prof.phone = data["phone"]
        elif current_user.role == UserRole.COORDINATOR:
            coord = db.query(Coordinator).filter(Coordinator.user_id == current_user.id).first()
            if coord:
                coord.phone = data["phone"]

    db.commit()
    db.refresh(current_user)
    audit_logger.log_data_change(current_user.username, "User", "UPDATE", current_user.id)
    return current_user
