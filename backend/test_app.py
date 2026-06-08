from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import app, get_db
from database import Base

# Use in-memory SQLite for tests
SQLALCHEMY_TEST_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

client = TestClient(app)

# ===== Authentication Tests =====

def test_register_student_without_student_id():
    """Student registration must fail without student ID"""
    response = client.post("/api/auth/register", json={
        "email": "test@student.com",
        "password": "Password123!",
        "full_name": "Test Student",
        "student_id": None,
        "is_instructor": False
    })
    assert response.status_code in [400, 422]

def test_register_student_with_student_id():
    """Student registration must succeed with student ID"""
    response = client.post("/api/auth/register", json={
        "email": "teststudent@test.com",
        "password": "Password123!",
        "full_name": "Test Student",
        "student_id": "STU001",
        "is_instructor": False
    })
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_register_instructor_without_student_id():
    """Instructor registration must succeed without student ID"""
    response = client.post("/api/auth/register", json={
        "email": "testinstructor@test.com",
        "password": "Password123!",
        "full_name": "Test Instructor",
        "student_id": None,
        "is_instructor": True
    })
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_login_valid_credentials():
    """Login must succeed with valid credentials"""
    # Register first
    client.post("/api/auth/register", json={
        "email": "instructor@test.com",
        "password": "Password123!",
        "full_name": "Test Instructor",
        "student_id": None,
        "is_instructor": True
    })
    response = client.post("/api/auth/login", json={
        "email": "instructor@test.com",
        "password": "Password123!"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_login_invalid_credentials():
    """Login must fail with wrong password"""
    client.post("/api/auth/register", json={
        "email": "instructor2@test.com",
        "password": "Password123!",
        "full_name": "Test Instructor",
        "student_id": None,
        "is_instructor": True
    })
    response = client.post("/api/auth/login", json={
        "email": "instructor2@test.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 401

def test_login_nonexistent_user():
    """Login must fail for non-existent user"""
    response = client.post("/api/auth/login", json={
        "email": "nobody@nowhere.com",
        "password": "Password123!"
    })
    assert response.status_code == 401

# ===== 20-Minute Attendance Window Tests =====

def test_session_expires_at_is_20_minutes():
    """Session expires_at must be exactly 20 minutes after started_at"""
    # Register instructor and course
    reg = client.post("/api/auth/register", json={
        "email": "instructor3@test.com",
        "password": "Password123!",
        "full_name": "Test Instructor",
        "student_id": None,
        "is_instructor": True
    })
    token = reg.json()["access_token"]

    # Create course first
    course = client.post("/api/courses",
        json={"name": "Test Course", "code": "TC101", "instructor": "Test Instructor"},
        headers={"Authorization": f"Bearer {token}"}
    )
    course_id = course.json()["id"]

    # Start session
    response = client.post("/api/sessions/start",
        json={"course_id": course_id, "description": "Test"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()

    started_at = datetime.fromisoformat(data["started_at"])
    expires_at = datetime.fromisoformat(data["expires_at"])
    diff = expires_at - started_at

    assert diff == timedelta(minutes=20), f"Expected 20 min window, got {diff}"

def test_student_cannot_mark_attendance_after_expiry():
    """Student must not be able to mark attendance with invalid session key"""
    student_reg = client.post("/api/auth/register", json={
        "email": "student@test.com",
        "password": "Password123!",
        "full_name": "Test Student",
        "student_id": "STU002",
        "is_instructor": False
    })
    student_token = student_reg.json()["access_token"]

    response = client.post("/api/attendance/join-session",
        json={"session_key": "session:expiredkey00000"},
        headers={"Authorization": f"Bearer {student_token}"}
    )
    assert response.status_code in [400, 404]

# ===== Session Registration Tests =====

def test_start_session_requires_auth():
    """Starting a session must require authentication"""
    response = client.post("/api/sessions/start",
        json={"course_id": 1, "description": "Test"}
    )
    assert response.status_code == 401

def test_start_session_requires_valid_course():
    """Starting a session must fail with invalid course ID"""
    reg = client.post("/api/auth/register", json={
        "email": "instructor4@test.com",
        "password": "Password123!",
        "full_name": "Test Instructor",
        "student_id": None,
        "is_instructor": True
    })
    token = reg.json()["access_token"]

    response = client.post("/api/sessions/start",
        json={"course_id": 99999, "description": "Test"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code in [400, 404]

def test_student_cannot_start_session():
    """Students must not be able to start sessions"""
    reg = client.post("/api/auth/register", json={
        "email": "student2@test.com",
        "password": "Password123!",
        "full_name": "Test Student",
        "student_id": "STU003",
        "is_instructor": False
    })
    token = reg.json()["access_token"]

    response = client.post("/api/sessions/start",
        json={"course_id": 1, "description": "Test"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403

def test_student_can_mark_attendance_on_active_session():
    """Student must be able to mark attendance on an active session"""
    # Register instructor
    inst_reg = client.post("/api/auth/register", json={
        "email": "instructor5@test.com",
        "password": "Password123!",
        "full_name": "Test Instructor",
        "student_id": None,
        "is_instructor": True
    })
    inst_token = inst_reg.json()["access_token"]

    # Create course
    course = client.post("/api/courses",
        json={"name": "Test Course", "code": "TC102", "instructor": "Test Instructor"},
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    course_id = course.json()["id"]

    # Start session
    session = client.post("/api/sessions/start",
        json={"course_id": course_id, "description": "Test"},
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    session_key = session.json()["session_key"]

    # Register student
    stu_reg = client.post("/api/auth/register", json={
        "email": "student3@test.com",
        "password": "Password123!",
        "full_name": "Test Student",
        "student_id": "STU004",
        "is_instructor": False
    })
    stu_token = stu_reg.json()["access_token"]

    # Mark attendance
    response = client.post("/api/attendance/join-session",
        json={"session_key": session_key},
        headers={"Authorization": f"Bearer {stu_token}"}
    )
    assert response.status_code == 200
