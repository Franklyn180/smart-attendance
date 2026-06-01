import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode.react'
import { Analytics, Course, Student } from './types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

function App() {
  const [students, setStudents] = useState<Student[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [studentName, setStudentName] = useState('')
  const [studentEmail, setStudentEmail] = useState('')
  const [studentRoll, setStudentRoll] = useState('')
  const [courseName, setCourseName] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [courseInstructor, setCourseInstructor] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const [scanCode, setScanCode] = useState('')
  const [message, setMessage] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const qrPayload = useMemo(() => {
    if (!selectedStudentId || !selectedCourseId) {
      return ''
    }
    return `attendance:${selectedStudentId}:${selectedCourseId}:${Date.now()}`
  }, [selectedStudentId, selectedCourseId])

  useEffect(() => {
    async function loadData() {
      const [courseRes, studentRes, analyticsRes] = await Promise.all([
        fetch(`${API_URL}/courses`),
        fetch(`${API_URL}/students`),
        fetch(`${API_URL}/analytics`),
      ])
      if (courseRes.ok) setCourses(await courseRes.json())
      if (studentRes.ok) setStudents(await studentRes.json())
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json())
    }
    loadData()
  }, [refreshKey])

  const reload = () => setRefreshKey((previous) => previous + 1)

  const submitStudent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!studentName || !studentEmail || !studentRoll) {
      setMessage('Student name, email, and roll number are required.')
      return
    }

    const response = await fetch(`${API_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: studentName,
        email: studentEmail,
        student_id: studentRoll,
      }),
    })

    if (response.ok) {
      setStudentName('')
      setStudentEmail('')
      setStudentRoll('')
      setMessage('Student registered successfully.')
      reload()
    } else {
      const body = await response.json()
      setMessage(body.detail || 'Unable to register student.')
    }
  }

  const submitCourse = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!courseName || !courseCode || !courseInstructor) {
      setMessage('Course name, code, and instructor are required.')
      return
    }

    const response = await fetch(`${API_URL}/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: courseName,
        code: courseCode,
        instructor: courseInstructor,
      }),
    })

    if (response.ok) {
      setCourseName('')
      setCourseCode('')
      setCourseInstructor('')
      setMessage('Course added successfully.')
      reload()
    } else {
      const body = await response.json()
      setMessage(body.detail || 'Unable to add course.')
    }
  }

  const submitScan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!scanCode) {
      setMessage('Scan data is required to mark attendance.')
      return
    }

    const response = await fetch(`${API_URL}/attendance/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scan_data: scanCode }),
    })

    if (response.ok) {
      setMessage('Attendance recorded successfully.')
      setScanCode('')
      reload()
    } else {
      const body = await response.json()
      setMessage(body.detail || 'Unable to record attendance.')
    }
  }

  return (
    <div className="app-shell">
      <header>
        <h1>Smart Attendance Management</h1>
        <p>Student registration, QR attendance, course management, and analytics in one dashboard.</p>
      </header>

      <section className="layout-grid">
        <article className="panel">
          <h2>Student Registration</h2>
          <form onSubmit={submitStudent} className="form-stack">
            <label>
              Student Name
              <input value={studentName} onChange={(event) => setStudentName(event.target.value)} />
            </label>
            <label>
              Student Email
              <input type="email" value={studentEmail} onChange={(event) => setStudentEmail(event.target.value)} />
            </label>
            <label>
              Roll / ID
              <input value={studentRoll} onChange={(event) => setStudentRoll(event.target.value)} />
            </label>
            <button type="submit">Register Student</button>
          </form>
        </article>

        <article className="panel">
          <h2>Course Management</h2>
          <form onSubmit={submitCourse} className="form-stack">
            <label>
              Course Name
              <input value={courseName} onChange={(event) => setCourseName(event.target.value)} />
            </label>
            <label>
              Course Code
              <input value={courseCode} onChange={(event) => setCourseCode(event.target.value)} />
            </label>
            <label>
              Lecturer Name
              <input value={courseInstructor} onChange={(event) => setCourseInstructor(event.target.value)} />
            </label>
            <button type="submit">Create Course</button>
          </form>
        </article>
      </section>

      <section className="layout-grid">
        <article className="panel">
          <h2>Attendance QR Generator</h2>
          <label>
            Select Student
            <select value={selectedStudentId ?? ''} onChange={(event) => setSelectedStudentId(Number(event.target.value) || null)}>
              <option value="">Select a student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.student_id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Select Course
            <select value={selectedCourseId ?? ''} onChange={(event) => setSelectedCourseId(Number(event.target.value) || null)}>
              <option value="">Select a course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
          {qrPayload && (
            <div className="qr-block">
              <p>Scan this code to record attendance for the selected student and course.</p>
              <div className="qr-frame">
                <QRCode value={qrPayload} size={180} />
              </div>
              <textarea readOnly rows={3} value={qrPayload} />
            </div>
          )}
        </article>

        <article className="panel">
          <h2>Scan Attendance</h2>
          <form onSubmit={submitScan} className="form-stack">
            <label>
              QR Payload
              <textarea value={scanCode} onChange={(event) => setScanCode(event.target.value)} rows={5} />
            </label>
            <button type="submit">Record Attendance</button>
          </form>
        </article>
      </section>

      <section className="analytics-panel">
        <article className="panel wide">
          <h2>Lecturer Dashboard</h2>
          <div className="stats-row">
            <div className="stat-card">
              <span>{students.length}</span>
              <p>Students registered</p>
            </div>
            <div className="stat-card">
              <span>{courses.length}</span>
              <p>Courses available</p>
            </div>
            <div className="stat-card">
              <span>{analytics?.total_attendance ?? 0}</span>
              <p>Total attendance records</p>
            </div>
          </div>

          <div className="analytics-list">
            <h3>Attendance Analytics</h3>
            {analytics?.attendance_by_course.length ? (
              analytics.attendance_by_course.map((item) => (
                <div key={item.course_name} className="analytics-item">
                  <strong>{item.course_name}</strong>
                  <span>{item.count} records</span>
                </div>
              ))
            ) : (
              <p>No attendance records yet.</p>
            )}
          </div>
        </article>
      </section>

      <section className="panel wide">
        <h2>Student and Course Lists</h2>
        <div className="tables-row">
          <div>
            <h3>Students</h3>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Roll</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td>{student.name}</td>
                    <td>{student.student_id}</td>
                    <td>{student.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3>Courses</h3>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Lecturer</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id}>
                    <td>{course.name}</td>
                    <td>{course.code}</td>
                    <td>{course.instructor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {message && <div className="toast">{message}</div>}
    </div>
  )
}

export default App
