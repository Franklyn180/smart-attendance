from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class CourseCreate(BaseModel):
    name: str
    code: str
    instructor: str

class CourseOut(CourseCreate):
    id: int

    class Config:
        from_attributes = True

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
    course_id: Optional[int]

    class Config:
        from_attributes = True

class AttendanceScan(BaseModel):
    scan_data: Optional[str] = None
    student_id: Optional[int] = None
    course_id: Optional[int] = None

class AttendanceOut(BaseModel):
    id: int
    student_id: int
    course_id: int
    timestamp: datetime
    status: str

    class Config:
        from_attributes = True

class AnalyticsOut(BaseModel):
    total_students: int
    total_courses: int
    total_attendance: int
    attendance_by_course: List[dict]
