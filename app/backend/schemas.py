from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# ===== Authentication Schemas =====
class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    student_id: Optional[str] = None
    is_instructor: bool = False


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    student_id: Optional[str]
    is_instructor: bool
    is_active: bool

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


# ===== Course Schemas =====
class CourseCreate(BaseModel):
    name: str
    code: str
    instructor: str


class CourseOut(CourseCreate):
    id: int

    class Config:
        from_attributes = True


# ===== Attendance Session Schemas =====
class AttendanceSessionCreate(BaseModel):
    course_id: int
    description: Optional[str] = None


class AttendanceSessionOut(BaseModel):
    id: int
    course_id: int
    instructor_id: int
    session_key: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_active: bool
    description: Optional[str] = None

    class Config:
        from_attributes = True


class AttendanceSessionResponse(BaseModel):
    """Extended session info returned to students listing active sessions"""
    id: int
    course_id: int
    instructor_id: int
    session_key: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_active: bool
    description: Optional[str] = None
    course: Optional[CourseOut] = None   # Optional so it never crashes if course missing

    class Config:
        from_attributes = True


class JoinSessionRequest(BaseModel):
    session_key: str


# ===== Attendance Schemas =====
class AttendanceScan(BaseModel):
    """Scan attendance via QR code"""
    scan_data: Optional[str] = None


class AttendanceOut(BaseModel):
    id: int
    session_id: int
    user_id: int
    course_id: int
    timestamp: datetime
    status: str
    user: UserOut

    class Config:
        from_attributes = True


# ===== Analytics Schemas =====
class AttendanceBySession(BaseModel):
    session_id: int
    course_name: str
    timestamp: str        # kept as str since crud returns str(s.started_at)
    count: int


class AnalyticsOut(BaseModel):
    total_students: int
    total_courses: int
    total_attendance: int
    attendance_by_session: List[AttendanceBySession]

    class Config:
        from_attributes = True


# ===== Legacy Student Schema (for backwards compatibility) =====
class StudentCreate(BaseModel):
    name: str
    email: EmailStr
    student_id: str
    course_id: Optional[int] = None


class StudentOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    student_id: str
    course_id: Optional[int] = None

    class Config:
        from_attributes = True