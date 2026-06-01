from sqlalchemy.orm import Session
from sqlalchemy import func
import models 
import schemas


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


def record_attendance(db: Session, student_id: int, course_id: int):
    attendance = models.Attendance(student_id=student_id, course_id=course_id, status='present')
    db.add(attendance)
    db.commit()
    db.refresh(attendance)
    return attendance


def get_analytics(db: Session):
    total_students = db.query(func.count(models.Student.id)).scalar() or 0
    total_courses = db.query(func.count(models.Course.id)).scalar() or 0
    total_attendance = db.query(func.count(models.Attendance.id)).scalar() or 0

    attendance_by_course = [
        {
            'course_name': row[0],
            'count': int(row[1] or 0),
        }
        for row in db.query(models.Course.name, func.count(models.Attendance.id))
        .join(models.Attendance, models.Attendance.course_id == models.Course.id, isouter=True)
        .group_by(models.Course.name)
        .all()
    ]

    return {
        'total_students': total_students,
        'total_courses': total_courses,
        'total_attendance': total_attendance,
        'attendance_by_course': attendance_by_course,
    }
