export interface Course {
  id: number
  name: string
  code: string
  instructor: string
}

export interface Student {
  id: number
  name: string
  email: string
  student_id: string
  course_id: number | null
  course?: Course | null
}

export interface AttendanceRecord {
  id: number
  student_id: number
  course_id: number
  timestamp: string
  status: string
}

export interface Analytics {
  total_students: number
  total_courses: number
  total_attendance: number
  attendance_by_course: Array<{ course_name: string; count: number }>
}
