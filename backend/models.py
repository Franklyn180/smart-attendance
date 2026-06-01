from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from database import Base

class Course(Base):
    __tablename__ = 'courses'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    code = Column(String(64), nullable=False, unique=True)
    instructor = Column(String(128), nullable=False)

    students = relationship('Student', back_populates='course', cascade='all, delete-orphan')
    attendance = relationship('Attendance', back_populates='course', cascade='all, delete-orphan')

class Student(Base):
    __tablename__ = 'students'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    email = Column(String(128), nullable=False, unique=True)
    student_id = Column(String(64), nullable=False, unique=True)
    course_id = Column(Integer, ForeignKey('courses.id'), nullable=True)

    course = relationship('Course', back_populates='students')
    attendance = relationship('Attendance', back_populates='student', cascade='all, delete-orphan')

class Attendance(Base):
    __tablename__ = 'attendance_records'

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey('students.id'), nullable=False)
    course_id = Column(Integer, ForeignKey('courses.id'), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    status = Column(String(64), nullable=False, default='present')

    student = relationship('Student', back_populates='attendance')
    course = relationship('Course', back_populates='attendance')
