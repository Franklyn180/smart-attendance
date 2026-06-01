import time

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

import crud
import models
import schemas
from database import SessionLocal, engine

app = FastAPI(
    title='Smart Attendance Management API',
    description='Backend service for student registration, QR attendance, course management, and analytics.',
)


@app.on_event('startup')
def startup_event():
    last_error = None
    for attempt in range(30):
        try:
            models.Base.metadata.create_all(bind=engine)
            return
        except OperationalError as error:
            last_error = error
            time.sleep(2)
    raise RuntimeError('Unable to connect to MySQL after several retries') from last_error

origins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get('/')
def root():
    return {
        'message': 'Welcome to Smart Attendance Management API',
        'endpoints': [
            '/api/health',
            '/api/students',
            '/api/courses',
            '/api/attendance/scan',
            '/api/analytics',
            '/docs'
        ],
    }


@app.get('/api')
def api_root():
    return {
        'message': 'API is available',
        'docs': '/docs',
    }


@app.get('/api/health')
def health_check():
    return {'status': 'ok'}


@app.get('/api/students', response_model=list[schemas.StudentOut])
def read_students(db: Session = Depends(get_db)):
    return crud.get_students(db)


@app.post('/api/students', response_model=schemas.StudentOut)
def create_student(student: schemas.StudentCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Student).filter(
        (models.Student.email == student.email) | (models.Student.student_id == student.student_id)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail='Student email or roll number already exists.')
    return crud.create_student(db, student)


@app.get('/api/courses', response_model=list[schemas.CourseOut])
def read_courses(db: Session = Depends(get_db)):
    return crud.get_courses(db)


@app.post('/api/courses', response_model=schemas.CourseOut)
def create_course(course: schemas.CourseCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Course).filter(models.Course.code == course.code).first()
    if existing:
        raise HTTPException(status_code=400, detail='Course code already exists.')
    return crud.create_course(db, course)


@app.post('/api/attendance/scan', response_model=schemas.AttendanceOut)
def scan_attendance(payload: schemas.AttendanceScan, db: Session = Depends(get_db)):
    student_id = payload.student_id
    course_id = payload.course_id
    if payload.scan_data:
        parts = payload.scan_data.split(':')
        if len(parts) < 3 or parts[0] != 'attendance':
            raise HTTPException(status_code=400, detail='Invalid QR payload format.')
        try:
            student_id = int(parts[1])
            course_id = int(parts[2])
        except ValueError:
            raise HTTPException(status_code=400, detail='Invalid student or course id in QR payload.')

    if student_id is None or course_id is None:
        raise HTTPException(status_code=400, detail='Provide either scan_data or student_id/course_id.')

    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not student or not course:
        raise HTTPException(status_code=404, detail='Student or course not found.')

    return crud.record_attendance(db, student_id, course_id)


@app.get('/api/analytics', response_model=schemas.AnalyticsOut)
def analytics(db: Session = Depends(get_db)):
    return crud.get_analytics(db)
