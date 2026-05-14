"""Testes da API — endpoints de autenticação e CRUD."""

import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import engine
from app.models.base import Base


# Gera sufixos únicos para evitar colisões com dados já existentes
_uid = uuid.uuid4().hex[:6]


@pytest.fixture(scope="module")
def client():
    """Cria tabelas em banco de teste e fornece client."""
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def auth_token(client):
    """Registra e autentica um usuário de teste."""
    # Registrar com username único
    client.post("/api/auth/register", json={
        "username": f"testuser_{_uid}",
        "full_name": "Test User",
        "email": f"test_{_uid}@test.com",
        "password": "test1234",
        "role": "admin",
    })
    # Login
    resp = client.post("/api/auth/login", json={
        "username": f"testuser_{_uid}",
        "password": "test1234",
    })
    return resp.json()["access_token"]


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
            "username": f"newuser_{_uid}",
            "password": "pass1234",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_login_fail(self, client):
        resp = client.post("/api/auth/login", json={
            "username": f"newuser_{_uid}",
            "password": "wrong",
        })
        assert resp.status_code == 401

    def test_me(self, client, auth_token):
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {auth_token}"})
        assert resp.status_code == 200
        assert resp.json()["username"] == f"testuser_{_uid}"


class TestStudentsAPI:
    def test_create_student(self, client, auth_token):
        h = {"Authorization": f"Bearer {auth_token}"}
        resp = client.post("/api/students/", json={
            "name": "Ana Silva",
            "registration_number": f"T{_uid}",
            "email": f"ana_{_uid}@test.com",
            "enrollment_date": "2024-02-01",
            "status": "active",
        }, headers=h)
        assert resp.status_code == 201

    def test_list_students(self, client, auth_token):
        h = {"Authorization": f"Bearer {auth_token}"}
        resp = client.get("/api/students/", headers=h)
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
