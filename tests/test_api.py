"""Testes basicos da API."""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal, engine
from app.main import app
from app.models.base import Base
from app.models.student import Student
from app.models.user import User, UserRole
from app.security.hashing import hash_password


_uid = uuid.uuid4().hex[:6]


@pytest.fixture
def client():
    """Cria tabelas no banco de teste configurado e fornece o TestClient."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        db.query(Student).filter(Student.registration_number == f"T{_uid}").delete()
        db.commit()
    finally:
        db.close()
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_client(client):
    """Cria um usuario admin local e autentica via cookie para testar RBAC."""
    db = SessionLocal()
    try:
        username = f"testadmin_{_uid}"
        if not db.query(User).filter(User.username == username).first():
            db.add(User(
                username=username,
                full_name="Test Admin",
                email=f"{username}@test.com",
                hashed_password=hash_password("test1234"),
                role=UserRole.ADMIN,
                is_active=True,
                is_approved=True,
            ))
            db.commit()
    finally:
        db.close()

    resp = client.post("/api/auth/login", json={
        "identifier": f"testadmin_{_uid}",
        "password": "test1234",
    })
    assert resp.status_code == 200
    assert "set-cookie" in resp.headers
    return client


class TestAuth:
    def test_register(self, client):
        resp = client.post("/api/auth/register", json={
            "username": f"newuser_{_uid}",
            "full_name": "New User",
            "email": f"new_{_uid}@test.com",
            "password": "pass1234",
            "role": "viewer",
        })
        assert resp.status_code == 201
        assert resp.json()["username"] == f"newuser_{_uid}"

    def test_login_success(self, client):
        resp = client.post("/api/auth/login", json={
            "identifier": f"newuser_{_uid}",
            "password": "pass1234",
        })
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["authenticated"] is True
        assert payload["token_type"] == "session_cookie"
        assert "access_token" not in payload

    def test_login_fail(self, client):
        resp = client.post("/api/auth/login", json={
            "identifier": f"newuser_{_uid}",
            "password": "wrong",
        })
        assert resp.status_code == 401

    def test_me(self, auth_client):
        resp = auth_client.get("/api/auth/me")
        assert resp.status_code == 200
        assert resp.json()["username"] == f"testadmin_{_uid}"

    def test_refresh_rotates_session(self, auth_client):
        resp = auth_client.post("/api/auth/refresh")
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["authenticated"] is True
        assert payload["token_type"] == "session_cookie"

    def test_list_sessions(self, auth_client):
        resp = auth_client.get("/api/auth/sessions")
        assert resp.status_code == 200
        sessions = resp.json()
        assert len(sessions) >= 1
        assert sessions[0]["session_identifier"]

    def test_revoke_named_session(self, auth_client):
        sessions_resp = auth_client.get("/api/auth/sessions")
        session_identifier = sessions_resp.json()[0]["session_identifier"]
        revoke_resp = auth_client.delete(f"/api/auth/sessions/{session_identifier}")
        assert revoke_resp.status_code == 204
        after = auth_client.get("/api/auth/me")
        assert after.status_code == 401

    def test_logout_all_clears_session(self, auth_client):
        resp = auth_client.post("/api/auth/logout-all")
        assert resp.status_code == 204
        after = auth_client.get("/api/auth/me")
        assert after.status_code == 401

    def test_logout_clears_session(self, auth_client):
        resp = auth_client.post("/api/auth/logout")
        assert resp.status_code == 204
        after = auth_client.get("/api/auth/me")
        assert after.status_code == 401


class TestStudentsAPI:
    def test_create_student(self, auth_client):
        resp = auth_client.post("/api/students/", json={
            "name": "Ana Silva",
            "registration_number": f"T{_uid}",
            "email": f"ana_{_uid}@test.com",
            "enrollment_date": "2024-02-01",
            "status": "ACTIVE",
        })
        assert resp.status_code == 201

    def test_list_students(self, auth_client):
        registration = f"TL{_uid}"
        auth_client.post("/api/students/", json={
            "name": "Ana Lista",
            "registration_number": registration,
            "email": f"analista_{_uid}@test.com",
            "enrollment_date": "2024-02-01",
            "status": "ACTIVE",
        })
        resp = auth_client.get(f"/api/students/?search={registration}")
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    def test_unauthorized(self, client):
        resp = client.get("/api/students/")
        assert resp.status_code == 401


class TestHealthCheck:
    def test_health(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "online"
