from datetime import datetime
from sqlalchemy.orm import Session, joinedload
from passlib.context import CryptContext
import models, schemas
import uuid

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# ===== User Management =====
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_id(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def create_user(db: Session, user: schemas.UserRegister):
    db_user = models.User(
        email=user.email,
        hashed_password=hash_password(user.password),
        full_name=user.full_name,
        student_id=user.student_id,
        is_instructor=user.is_instructor,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user

# ===== Attendance Session Management =====
def create_attendance_session(db: Session, course_id: int, instructor_id: int, description: str = None):
    now = datetime.utcnow()
    session_key = f"session:{uuid.uuid4().hex[:16]}"
    db_session = models.AttendanceSession(
        course_id=course_id,
        instructor_id=instructor_id,
        session_key=session_key,
        started_at=now,
        description=description,
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

def finalize_attendance_session(db: Session, session_id: int):
    session = get_session_by_id(db, session_id)
    if not session or not session.is_active:
        return session

    present_user_ids = [attendance.user_id for attendance in session.attendance]
    missing_students = db.query(models.User).filter(
        models.User.is_instructor == False,
        models.User.student_id != None,
        ~models.User.id.in_(present_user_ids)
    ).all()

    for student in missing_students:
        absent_record = models.Attendance(
            user_id=student.id,
            session_id=session.id,
            course_id=session.course_id,
            status='absent',
        )
        db.add(absent_record)

    session.is_active = False
    session.ended_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return session

def expire_timed_out_sessions(db: Session):
    now = datetime.utcnow()
    active_sessions = db.query(models.AttendanceSession).filter(
        models.AttendanceSession.is_active == True
    ).all()
    for session in active_sessions:
        if session.expires_at and session.expires_at <= now:
            finalize_attendance_session(db, session.id)

def get_session_by_key(db: Session, session_key: str):
    return db.query(models.AttendanceSession).filter(
        models.AttendanceSession.session_key == session_key
    ).first()

def get_active_sessions_for_course(db: Session, course_id: int):
    return db.query(models.AttendanceSession).filter(
        models.AttendanceSession.course_id == course_id,
        models.AttendanceSession.is_active == True,
    ).all()

def get_session_by_id(db: Session, session_id: int):
    return db.query(models.AttendanceSession).filter(
        models.AttendanceSession.id == session_id
    ).first()

def end_attendance_session(db: Session, session_id: int):
    session = get_session_by_id(db, session_id)
    if session:
        session.is_active = False
        db.commit()
        db.refresh(session)
    return session

def get_instructor_sessions(db: Session, instructor_id: int):
    return db.query(models.AttendanceSession).filter(
        models.AttendanceSession.instructor_id == instructor_id
    ).all()

# ===== Attendance Recording =====
def record_attendance(db: Session, user_id: int, session_id: int, course_id: int):
    # Check if already marked present in this session
    existing = db.query(models.Attendance).filter(
        models.Attendance.user_id == user_id,
        models.Attendance.session_id == session_id,
    ).options(joinedload(models.Attendance.user)).first()

    if existing:
        return existing  # Already marked, return existing record

    record = models.Attendance(
        user_id=user_id,
        session_id=session_id,
        course_id=course_id,
        timestamp=datetime.utcnow(),
        status="present"
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    # Reload with user relationship so response includes student_id
    return db.query(models.Attendance).options(
        joinedload(models.Attendance.user)
    ).filter(models.Attendance.id == record.id).first()

def get_session_attendance(db: Session, session_id: int):
    # Eager-load user so student_id is included in the response
    return db.query(models.Attendance).options(
        joinedload(models.Attendance.user)
    ).filter(
        models.Attendance.session_id == session_id
    ).all()

# ===== Analytics =====
def get_analytics(db: Session):
    total_students = db.query(models.User).filter(models.User.is_instructor == False).count()
    total_courses = db.query(models.Course).count()
    total_attendance = db.query(models.Attendance).count()

    sessions = db.query(models.AttendanceSession).all()
    attendance_by_session = []

    for s in sessions:
        count = db.query(models.Attendance).filter(
            models.Attendance.session_id == s.id
        ).count()
        course = db.query(models.Course).filter(models.Course.id == s.course_id).first()
        attendance_by_session.append({
            "session_id": s.id,
            "course_name": course.name if course else "Unknown",
            "timestamp": str(s.started_at),
            "count": count
        })

    return {
        "total_students": total_students,
        "total_courses": total_courses,
        "total_attendance": total_attendance,
        "attendance_by_session": attendance_by_session,
    }

# ===== Legacy Functions (backwards compatibility) =====
def get_students(db: Session):
    return db.query(models.Student).all()

def get_courses(db: Session):
    return db.query(models.Course).all()

def create_course(db: Session, course: schemas.CourseCreate):
    db_course = models.Course(name=course.name, code=course.code, instructor=course.instructor)
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    return db_course

def create_student(db: Session, student: schemas.StudentCreate):
    db_student = models.Student(
        name=student.name,
        email=student.email,
        student_id=student.student_id,
        course_id=student.course_id,
    )
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    return db_student
