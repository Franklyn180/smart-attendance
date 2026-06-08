from datetime import timedelta

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(128), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(128), nullable=False)
    student_id = Column(String(64), nullable=True, unique=True, index=True)  # NULL for instructors
    is_instructor = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    attendance_records = relationship('Attendance', back_populates='user')
    sessions_created = relationship('AttendanceSession', back_populates='instructor')

class Course(Base):
    __tablename__ = 'courses'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    code = Column(String(64), nullable=False, unique=True)
    instructor = Column(String(128), nullable=False)

    sessions = relationship('AttendanceSession', back_populates='course', cascade='all, delete-orphan')
    attendance = relationship('Attendance', back_populates='course', cascade='all, delete-orphan')

class AttendanceSession(Base):
    __tablename__ = 'attendance_sessions'

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey('courses.id'), nullable=False)
    instructor_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    session_key = Column(String(128), nullable=False, unique=True, index=True)  # QR payload
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    description = Column(Text, nullable=True)  # Optional: "Lecture on Topic X"

    course = relationship('Course', back_populates='sessions')
    instructor = relationship('User', back_populates='sessions_created')
    attendance = relationship('Attendance', back_populates='session', cascade='all, delete-orphan')

    @property
    def expires_at(self):
        if self.started_at:
            return self.started_at + timedelta(minutes=20)
        return None

class Attendance(Base):
    __tablename__ = 'attendance_records'

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey('attendance_sessions.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    course_id = Column(Integer, ForeignKey('courses.id'), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    status = Column(String(64), nullable=False, default='present')

    session = relationship('AttendanceSession', back_populates='attendance')
    user = relationship('User', back_populates='attendance_records')
    course = relationship('Course', back_populates='attendance')

class Student(Base):
    """Legacy model - keeping for backwards compatibility during migration"""
    __tablename__ = 'students'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    email = Column(String(128), nullable=False, unique=True)
    student_id = Column(String(64), nullable=False, unique=True)
    course_id = Column(Integer, ForeignKey('courses.id'), nullable=True)

    course = relationship('Course')
