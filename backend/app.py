# ruff: noqa: B008

import os
import time
from datetime import datetime, timedelta

import jwt
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, joinedload

import crud
import models
import schemas
from database import SessionLocal, engine

# JWT Configuration
SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

app = FastAPI(
    title='Smart Attendance Management API',
    description='Backend service for student/instructor login, QR-based attendance, course management, and analytics.',
)


@app.on_event('startup')
def startup_event():
    last_error = None
    for _ in range(30):
        try:
            models.Base.metadata.create_all(bind=engine)
            seed_demo_data()
            return
        except OperationalError as error:
            last_error = error
            time.sleep(2)
    raise RuntimeError('Unable to connect to MySQL after several retries') from last_error


def seed_demo_data():
    db = SessionLocal()
    try:
        instructor_email = 'instructor@demo.com'
        student_email = 'student@demo.com'
        course_code = 'DEMO101'

        instructor = crud.get_user_by_email(db, instructor_email)
        if not instructor:
            instructor = crud.create_user(db, schemas.UserRegister(
                email=instructor_email,
                password='Password123!',
                full_name='Demo Instructor',
                student_id=None,
                is_instructor=True,
            ))

        student = crud.get_user_by_email(db, student_email)
        if not student:
            student = crud.create_user(db, schemas.UserRegister(
                email=student_email,
                password='Password123!',
                full_name='Demo Student',
                student_id='STU1001',
                is_instructor=False,
            ))

        course = db.query(models.Course).filter(models.Course.code == course_code).first()
        if not course:
            course = crud.create_course(db, schemas.CourseCreate(
                name='Demo Course',
                code=course_code,
                instructor='Demo Instructor',
            ))

        active_session = db.query(models.AttendanceSession).filter(
            models.AttendanceSession.course_id == course.id,
            models.AttendanceSession.instructor_id == instructor.id,
            models.AttendanceSession.is_active,
        ).first()

        if not active_session:
            crud.create_attendance_session(
                db,
                course.id,
                instructor.id,
                description='Demo attendance session'
            )
    finally:
        db.close()


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_access_token(user_id: int, expires_delta: timedelta | None = None):
    expire = datetime.utcnow() + (
        expires_delta if expires_delta else timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    )
    return jwt.encode({"user_id": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError as err:
        raise HTTPException(status_code=401, detail="Token expired") from err
    except jwt.InvalidTokenError as err:
        raise HTTPException(status_code=401, detail="Invalid token") from err

    user = crud.get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return user


# ===== Auth =====
@app.post('/api/auth/register', response_model=schemas.TokenResponse)
def register(user: schemas.UserRegister, db: Session = Depends(get_db)):
    if crud.get_user_by_email(db, user.email):
        raise HTTPException(status_code=400, detail='Email already registered.')

    if not user.is_instructor and not user.student_id:
        raise HTTPException(status_code=400, detail='Student ID is required for student registration.')

    if user.student_id:
        if db.query(models.User).filter(models.User.student_id == user.student_id).first():
            raise HTTPException(status_code=400, detail='Student ID already registered.')

    db_user = crud.create_user(db, user)
    return {
        'access_token': create_access_token(db_user.id),
        'token_type': 'bearer',
        'user': db_user,
    }


@app.post('/api/auth/login', response_model=schemas.TokenResponse)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, credentials.email, credentials.password)
    if not user:
        raise HTTPException(status_code=401, detail='Invalid email or password.')

    return {
        'access_token': create_access_token(user.id),
        'token_type': 'bearer',
        'user': user,
    }


@app.get('/api/auth/me', response_model=schemas.UserOut)
def get_current_user_info(current_user: models.User = Depends(get_current_user)):
    return current_user


# ===== Courses =====
@app.get('/api/courses', response_model=list[schemas.CourseOut])
def read_courses(db: Session = Depends(get_db)):
    return crud.get_courses(db)


@app.post('/api/courses', response_model=schemas.CourseOut)
def create_course(
    course: schemas.CourseCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_instructor:
        raise HTTPException(status_code=403, detail='Only instructors can create courses.')

    if db.query(models.Course).filter(models.Course.code == course.code).first():
        raise HTTPException(status_code=400, detail='Course code already exists.')

    return crud.create_course(db, course)


# ===== Sessions =====
@app.post('/api/sessions/start', response_model=schemas.AttendanceSessionOut)
def start_session(
    session_data: schemas.AttendanceSessionCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_instructor:
        raise HTTPException(status_code=403, detail='Only instructors can start sessions.')

    course = db.query(models.Course).filter(models.Course.id == session_data.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail='Course not found.')

    return crud.create_attendance_session(
        db,
        session_data.course_id,
        current_user.id,
        session_data.description
    )


@app.get('/api/sessions/active', response_model=list[schemas.AttendanceSessionResponse])
def get_active_sessions(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    crud.expire_timed_out_sessions(db)

    return db.query(models.AttendanceSession).options(
        joinedload(models.AttendanceSession.course)
    ).filter(
        models.AttendanceSession.is_active
    ).all()


@app.get('/api/sessions/instructor-sessions', response_model=list[schemas.AttendanceSessionOut])
def get_instructor_sessions(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_instructor:
        raise HTTPException(status_code=403, detail='Only instructors can view their sessions.')

    crud.expire_timed_out_sessions(db)
    return crud.get_instructor_sessions(db, current_user.id)


@app.post('/api/sessions/{session_id}/end', response_model=schemas.AttendanceSessionOut)
def end_session(
    session_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_instructor:
        raise HTTPException(status_code=403, detail='Only instructors can end sessions.')

    session = crud.get_session_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found.')

    if session.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail='Not your session.')

    return crud.finalize_attendance_session(db, session_id)


@app.get('/api/sessions/{session_id}/attendance', response_model=list[schemas.AttendanceOut])
def get_session_attendance(
    session_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_instructor:
        raise HTTPException(status_code=403, detail='Only instructors can view session attendance.')

    session = crud.get_session_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found.')

    if session.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail='Not your session.')

    return crud.get_session_attendance(db, session_id)


# ===== Attendance =====
@app.post('/api/attendance/join-session', response_model=schemas.AttendanceOut)
def join_session(
    request: schemas.JoinSessionRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.is_instructor:
        raise HTTPException(status_code=403, detail='Instructors cannot mark attendance.')

    session = crud.get_session_by_key(db, request.session_key)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found.')

    if not session.is_active:
        raise HTTPException(status_code=400, detail='Session closed.')

    if session.expires_at and datetime.utcnow() > session.expires_at:
        crud.finalize_attendance_session(db, session.id)
        raise HTTPException(status_code=400, detail='Expired.')

    return crud.record_attendance(db, current_user.id, session.id, session.course_id)


@app.post('/api/attendance/scan', response_model=schemas.AttendanceOut)
def scan_attendance(
    payload: schemas.AttendanceScan,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.is_instructor:
        raise HTTPException(status_code=403, detail='Instructors cannot mark attendance.')

    session = crud.get_session_by_key(db, payload.scan_data)
    if not session:
        raise HTTPException(status_code=404, detail='Invalid QR code.')

    if not session.is_active:
        raise HTTPException(status_code=400, detail='Session closed.')

    return crud.record_attendance(db, current_user.id, session.id, session.course_id)


# ===== Analytics =====
@app.get('/api/analytics', response_model=schemas.AnalyticsOut)
def analytics(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_instructor:
        raise HTTPException(status_code=403, detail='Only instructors can view analytics.')
    return crud.get_analytics(db)


# ===== Students =====
@app.get('/api/users/students', response_model=list[schemas.UserOut])
def get_students(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_instructor:
        raise HTTPException(status_code=403, detail='Only instructors can view students.')

    return db.query(models.User).filter(
        ~models.User.is_instructor
    ).all()
