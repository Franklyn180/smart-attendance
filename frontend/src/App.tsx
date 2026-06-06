import React, { useEffect, useState } from 'react'
import * as QRCodeReact from 'qrcode.react'
import { Html5Qrcode } from 'html5-qrcode'
import './styles.css'

type QRCodeProps = { value: string; size?: number }
type QRCodeModule = { QRCodeSVG?: React.ComponentType<QRCodeProps>; default?: React.ComponentType<QRCodeProps> }
const QRCodeComponent = ((QRCodeReact as unknown as QRCodeModule).QRCodeSVG || (QRCodeReact as unknown as QRCodeModule).default) as React.ComponentType<QRCodeProps>

const defaultApiUrl = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:8001/api`
  : 'http://localhost:8001/api'

const API_URL = import.meta.env.VITE_API_URL ?? defaultApiUrl

interface User {
  id: number
  email: string
  full_name: string
  student_id: string | null
  is_instructor: boolean
  is_active: boolean
}

interface Course {
  id: number
  name: string
  code: string
  instructor: string
}

interface AttendanceSession {
  id: number
  course_id: number
  instructor_id: number
  session_key: string
  started_at: string
  ended_at: string | null
  expires_at?: string | null
  is_active: boolean
  description: string | null
  course?: Course
}

interface AttendanceRecord {
  id: number
  session_id: number
  user_id: number
  course_id: number
  timestamp: string
  status: string
  user: {
    id: number
    full_name: string
    student_id: string | null
  }
}

interface Analytics {
  total_students: number
  total_courses: number
  total_attendance: number
  attendance_by_session: Array<{
    session_id: number
    course_name: string
    timestamp: string
    count: number
  }>
}


function App() {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string>('')
  const [courses, setCourses] = useState<Course[]>([])
  const [activeSessions, setActiveSessions] = useState<AttendanceSession[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  // Form states
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerName, setRegisterName] = useState('')
  const [registerStudentId, setRegisterStudentId] = useState('')
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [isInstructor, setIsInstructor] = useState(false)

  // Instructor form states
  const [courseName, setCourseName] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [courseInstructor, setCourseInstructor] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null)
  const [sessionDescription, setSessionDescription] = useState('')
  const [instructorSessions, setInstructorSessions] = useState<AttendanceSession[]>([])
  const [sessionAttendance, setSessionAttendance] = useState<Record<number, AttendanceRecord[]>>({})
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null)
  const [now, setNow] = useState<number>(Date.now())

  // Student scanning states
  const [scanData, setScanData] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [scannerInstance, setScannerInstance] = useState<Html5Qrcode | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Persist login token across refreshes
  useEffect(() => {
    const savedToken = localStorage.getItem('attendance_token')
    if (savedToken) {
      setToken(savedToken)
    }
  }, [])

  useEffect(() => {
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    setIsMobile(mobile)
  }, [])

  // Load user data on token change
  useEffect(() => {
    if (token) {
      loadUserData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const loadUserData = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
        await loadCourses()
        if (userData.is_instructor) {
          await loadInstructorSessions()
          await loadAnalytics()
        } else {
          await loadActiveSessions()
        }
      } else {
        localStorage.removeItem('attendance_token')
        setToken('')
        setUser(null)
      }
    } catch (error) {
      console.error('Error loading user data:', error)
    }
  }

  const loadCourses = async () => {
    try {
      const response = await fetch(`${API_URL}/courses`)
      if (response.ok) {
        setCourses(await response.json())
      }
    } catch (error) {
      console.error('Error loading courses:', error)
    }
  }

  const loadActiveSessions = async () => {
    try {
      const response = await fetch(`${API_URL}/sessions/active`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        setActiveSessions(await response.json())
      }
    } catch (error) {
      console.error('Error loading active sessions:', error)
    }
  }

  const loadInstructorSessions = async () => {
    if (!token) return
    try {
      const response = await fetch(`${API_URL}/sessions/instructor-sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        setInstructorSessions(await response.json())
      }
    } catch (error) {
      console.error('Error loading instructor sessions:', error)
    }
  }

  const loadAnalytics = async () => {
    if (!token) return
    setAnalyticsLoading(true)
    try {
      const response = await fetch(`${API_URL}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        console.error('Analytics failed')
        setAnalytics(null)
        return
      }
      const data = await response.json()
      setAnalytics(data)
    } catch (error) {
      console.error('Analytics error:', error)
      setAnalytics(null)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const getCountdown = (session: AttendanceSession) => {
  const expiryStr = session.expires_at || 
    new Date(new Date(session.started_at + 'Z').getTime() + 20 * 60 * 1000).toISOString()
  const expiry = new Date(expiryStr.endsWith('Z') ? expiryStr : expiryStr + 'Z').getTime()
  const remaining = Math.max(0, Math.floor((expiry - now) / 1000))
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0')
  const seconds = String(remaining % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

  const isSessionOpen = (session: AttendanceSession) => {
  const expiryStr = session.expires_at || 
    new Date(new Date(session.started_at + 'Z').getTime() + 20 * 60 * 1000).toISOString()
  const expiry = new Date(expiryStr.endsWith('Z') ? expiryStr : expiryStr + 'Z').getTime()
  return expiry > now
}

  const loadSessionAttendance = async (sessionId: number) => {
    if (!token) return
    setMessage('')
    try {
      const response = await fetch(`${API_URL}/sessions/${sessionId}/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const attendanceData = await response.json()
        setSessionAttendance((prev) => ({ ...prev, [sessionId]: attendanceData }))
      } else {
        const data = await response.json()
        setMessage(data.detail || 'Failed to load attendance records')
      }
    } catch {
      setMessage('Error loading attendance records')
    }
  }

  const toggleSessionAttendance = async (sessionId: number) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null)
      return
    }
    if (!sessionAttendance[sessionId]) {
      await loadSessionAttendance(sessionId)
    }
    setExpandedSessionId(sessionId)
  }

  // Authentication functions
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem('attendance_token', data.access_token)
        setToken(data.access_token)
        setUser(data.user)
        setLoginEmail('')
        setLoginPassword('')
        setMessage('Login successful!')
        await loadCourses()
        if (data.user.is_instructor) {
          await loadInstructorSessions()
          await loadAnalytics()
        } else {
          await loadActiveSessions()
        }
      } else {
        const data = await response.json()
        setMessage(data.detail || 'Login failed')
      }
    } catch {
      setMessage('Error during login')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (!isInstructor && !registerStudentId.trim()) {
      setMessage('Student ID is required for student registration.')
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerEmail,
          password: registerPassword,
          full_name: registerName,
          student_id: registerStudentId || null,
          is_instructor: isInstructor,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem('attendance_token', data.access_token)
        setToken(data.access_token)
        setUser(data.user)
        setRegisterEmail('')
        setRegisterPassword('')
        setRegisterName('')
        setRegisterStudentId('')
        setIsRegisterMode(false)
        setMessage('Registration successful!')
        await loadCourses()
        if (data.user.is_instructor) {
          await loadInstructorSessions()
          await loadAnalytics()
        } else {
          await loadActiveSessions()
        }
      } else {
        const data = await response.json()
        setMessage(data.detail || 'Registration failed')
      }
    } catch {
      setMessage('Error during registration')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('attendance_token')
    setUser(null)
    setToken('')
    setLoginEmail('')
    setLoginPassword('')
    setCourses([])
    setActiveSessions([])
    setAnalytics(null)
    setInstructorSessions([])
    setSessionAttendance({})
  }

  // Instructor functions
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (!courseName || !courseCode || !courseInstructor) {
      setMessage('Please fill in all course fields')
      return
    }

    try {
      const response = await fetch(`${API_URL}/courses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: courseName,
          code: courseCode,
          instructor: courseInstructor,
        }),
      })

      if (response.ok) {
        setMessage('Course created successfully')
        setCourseName('')
        setCourseCode('')
        setCourseInstructor('')
        await loadCourses()
      } else {
        const data = await response.json()
        setMessage(data.detail || 'Failed to create course')
      }
    } catch {
      setMessage('Error creating course')
    }
  }

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (!selectedCourse) {
      setMessage('Please select a course')
      return
    }

    try {
      const response = await fetch(`${API_URL}/sessions/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          course_id: selectedCourse,
          description: sessionDescription,
        }),
      })

      if (response.ok) {
        setMessage('Attendance session started!')
        setSelectedCourse(null)
        setSessionDescription('')
        await refreshData()
      } else {
        const data = await response.json()
        setMessage(data.detail || 'Failed to start session')
      }
    } catch {
      setMessage('Error starting session')
    }
  }

  const handleEndSession = async (sessionId: number) => {
    try {
      const response = await fetch(`${API_URL}/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        setMessage('Session ended')
        await refreshData()
      } else {
        setMessage('Failed to end session')
      }
    } catch {
      setMessage('Error ending session')
    }
  }

  // Student functions
  const handleJoinSession = async (sessionKey: string) => {
    setMessage('')
    try {
      const response = await fetch(`${API_URL}/attendance/join-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ session_key: sessionKey }),
      })

      if (response.ok) {
        setMessage('✓ Attendance marked successfully!')
        setScanData('')
        await loadActiveSessions()
      } else {
        const data = await response.json()
        setMessage(data.detail || 'Failed to mark attendance')
      }
    } catch {
      setMessage('Error marking attendance')
    }
  }

  const stopScanner = async () => {
    if (scannerInstance) {
      try {
        await scannerInstance.stop()
      } catch (error) {
        console.warn('Error stopping QR scanner:', error)
      }
      try {
        await scannerInstance.clear()
      } catch (error) {
        console.warn('Error clearing QR scanner:', error)
      }
      setScannerInstance(null)
    }
    setShowScanner(false)
  }

  useEffect(() => {
    if (!showScanner || !isMobile) {
      return
    }

    const qrRegionId = 'qr-reader'
    let html5QrCode: Html5Qrcode

    const startScanner = async () => {
      await new Promise(resolve => setTimeout(resolve, 300))

      html5QrCode = new Html5Qrcode(qrRegionId)

      html5QrCode
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 280 },
          (decodedText) => {
            if (decodedText) {
              setScanData(decodedText)
              handleJoinSession(decodedText)
              stopScanner()
            }
          },
          () => {
            // ignore non-fatal scan errors
          },
        )
        .then(() => setScannerInstance(html5QrCode))
        .catch((error) => {
          console.error('QR scanner start failed:', error)
          setMessage('Unable to open camera scanner. Please allow camera access or use manual entry.')
          try {
            html5QrCode.clear()
          } catch {
            // ignore
          }
          setShowScanner(false)
        })
    }

    startScanner()

    return () => {
      if (html5QrCode) {
        html5QrCode
          .stop()
          .catch(() => null)
          .finally(() => {
            try {
              html5QrCode.clear()
            } catch {
              // ignore
            }
          })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showScanner, isMobile])

  // ===== Render login/register screen =====
  if (!user) {
    return (
      <div className="app-shell">
        <header>
          <h1>Smart Attendance Management</h1>
          <p>Login to access the attendance system</p>
        </header>

        <section className="auth-container">
          <div className="auth-panel">
            {!isRegisterMode ? (
              <>
                <h2>Login</h2>
                <div className="demo-credentials">
                  <p><strong>Demo accounts:</strong></p>
                  <p>Instructor: instructor@demo.com / Password123!</p>
                  <p>Student: student@demo.com / Password123!</p>
                </div>
                <form onSubmit={handleLogin} className="form-stack">
                  <label>
                    Email
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      disabled={loading}
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={loading}
                    />
                  </label>
                  <button type="submit" disabled={loading}>
                    {loading ? 'Logging in...' : 'Login'}
                  </button>
                </form>
                <p>
                  Don't have an account?{' '}
                  <button type="button" onClick={() => setIsRegisterMode(true)} className="link-button">
                    Register here
                  </button>
                </p>
              </>
            ) : (
              <>
                <h2>Register</h2>
                <form onSubmit={handleRegister} className="form-stack">
                  <label>
                    Full Name
                    <input
                      type="text"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      disabled={loading}
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      disabled={loading}
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      disabled={loading}
                    />
                  </label>
                  <label>
                    Register as Instructor
                    <input
                      type="checkbox"
                      checked={isInstructor}
                      onChange={(e) => setIsInstructor(e.target.checked)}
                      disabled={loading}
                    />
                  </label>
                  {!isInstructor && (
                    <label>
                      Student ID (required)
                      <input
                        type="text"
                        value={registerStudentId}
                        onChange={(e) => setRegisterStudentId(e.target.value)}
                        disabled={loading}
                      />
                    </label>
                  )}
                  <button type="submit" disabled={loading}>
                    {loading ? 'Registering...' : 'Register'}
                  </button>
                </form>
                <p>
                  Already have an account?{' '}
                  <button type="button" onClick={() => setIsRegisterMode(false)} className="link-button">
                    Login here
                  </button>
                </p>
              </>
            )}
            {message && (
              <p className={`message ${message.includes('✓') ? 'success' : 'error'}`}>{message}</p>
            )}
          </div>
        </section>
      </div>
    )
  }

  // ===== Render instructor dashboard =====
  if (user.is_instructor) {
    return (
      <div className="app-shell">
        <header>
          <h1>Instructor Dashboard</h1>
          <p>Welcome, {user.full_name}</p>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </header>

        <section className="layout-grid">
          <article className="panel">
            <h2>Create Course</h2>
            <form onSubmit={handleCreateCourse} className="form-stack">
              <label>
                Course Name
                <input value={courseName} onChange={(e) => setCourseName(e.target.value)} />
              </label>
              <label>
                Course Code
                <input value={courseCode} onChange={(e) => setCourseCode(e.target.value)} />
              </label>
              <label>
                Instructor Name
                <input value={courseInstructor} onChange={(e) => setCourseInstructor(e.target.value)} />
              </label>
              <button type="submit">Create Course</button>
            </form>
          </article>

          <article className="panel">
            <h2>Start Attendance Session</h2>
            <form onSubmit={handleStartSession} className="form-stack">
              <label>
                Select Course
                <select
                  value={selectedCourse ?? ''}
                  onChange={(e) => setSelectedCourse(Number(e.target.value) || null)}
                >
                  <option value="">Select a course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name} ({course.code})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Session Description (optional)
                <input
                  value={sessionDescription}
                  onChange={(e) => setSessionDescription(e.target.value)}
                  placeholder="e.g., Lecture 5 - Database Design"
                />
              </label>
              <button type="submit">Start Session</button>
            </form>
          </article>
        </section>

        <section className="panel wide">
          <h2>Active Sessions</h2>
          {instructorSessions.filter((s) => s.is_active).length === 0 ? (
            <p>No active sessions</p>
          ) : (
            <div className="sessions-grid">
              {instructorSessions
                .filter((s) => s.is_active)
                .map((session) => (
                  <div key={session.id} className="session-card">
                    <h3>{courses.find((c) => c.id === session.course_id)?.name || 'Course'}</h3>
                    <p>Session ID: {session.id}</p>
                    <p>{session.description || 'No description'}</p>
                    <div className="qr-display">
                      <QRCodeComponent value={session.session_key} size={150} />
                    </div>
                    <div className="session-meta">
                      <p className="session-key">{session.session_key}</p>
                      <p className="timer-label">
                        Attendance open for: <strong>{getCountdown(session)}</strong>
                      </p>
                      {!isSessionOpen(session) && (
                        <p className="timer-expired">Attendance window closed</p>
                      )}
                    </div>
                    <button onClick={() => handleEndSession(session.id)} className="end-btn">
                      End Session
                    </button>
                    <button
                      onClick={() => toggleSessionAttendance(session.id)}
                      className="view-btn"
                    >
                      {expandedSessionId === session.id ? 'Hide Attendance' : 'View Attendance'}
                    </button>
                    {expandedSessionId === session.id && sessionAttendance[session.id] && (
                      <div className="attendance-table">
                        <h4>Student Attendance</h4>
                        {sessionAttendance[session.id].length > 0 ? (
                          <table>
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Student ID</th>
                                <th>Status</th>
                                <th>Checked In</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sessionAttendance[session.id].map((record) => (
                                <tr key={record.id}>
                                  <td>{record.user.full_name}</td>
                                  <td>{record.user.student_id || 'N/A'}</td>
                                  <td>{record.status}</td>
                                  <td>{new Date(record.timestamp).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p>No students have marked attendance yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </section>

        <section className="panel wide">
          <h2>Past Sessions</h2>
          {instructorSessions.filter((s) => !s.is_active).length === 0 ? (
            <p>No past sessions</p>
          ) : (
            <div className="sessions-grid">
              {instructorSessions
                .filter((s) => !s.is_active)
                .map((session) => (
                  <div key={session.id} className="session-card">
                    <h3>{courses.find((c) => c.id === session.course_id)?.name || 'Course'}</h3>
                    <p>Session ID: {session.id}</p>
                    <p>{session.description || 'No description'}</p>
                    <div className="session-meta">
                      <p className="session-key">{session.session_key}</p>
                      <p className="timer-label">Attendance window ended</p>
                      <p className="timer-summary">Total students marked attendance: <strong>{(sessionAttendance[session.id]?.length ?? 0)}</strong></p>
                    </div>
                    <button onClick={() => toggleSessionAttendance(session.id)} className="view-btn">
                      {expandedSessionId === session.id ? 'Hide Attendance' : 'View Attendance'}
                    </button>

                    {expandedSessionId === session.id && sessionAttendance[session.id] && (
                      <div className="attendance-table">
                        <h4>Student Attendance</h4>
                        {sessionAttendance[session.id].length > 0 ? (
                          <table>
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Student ID</th>
                                <th>Status</th>
                                <th>Checked In</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sessionAttendance[session.id].map((record) => (
                                <tr key={record.id}>
                                  <td>{record.user.full_name}</td>
                                  <td>{record.user.student_id || 'N/A'}</td>
                                  <td>{record.status}</td>
                                  <td>{new Date(record.timestamp).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p>No students marked attendance for this session.</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </section>

        <section className="analytics-panel">
          <article className="panel wide">
            <h2>Attendance Analytics</h2>
            {analyticsLoading ? (
              <p>Loading analytics...</p>
            ) : analytics ? (
              <>
                <div className="stats-row">
                  <div className="stat-card">
                    <span>{analytics.total_students}</span>
                    <p>Students Registered</p>
                  </div>
                  <div className="stat-card">
                    <span>{analytics.total_courses}</span>
                    <p>Courses</p>
                  </div>
                  <div className="stat-card">
                    <span>{analytics.total_attendance}</span>
                    <p>Total Attendance Records</p>
                  </div>
                </div>
                <div className="analytics-list">
                  <h3>Attendance by Session</h3>
                  {(analytics.attendance_by_session?.length ?? 0) > 0 ? (
                    analytics.attendance_by_session.map((item) => (
                      <div key={item.session_id} className="analytics-item">
                        <strong>{item.course_name}</strong>
                        <span>{item.count} students marked present</span>
                      </div>
                    ))
                  ) : (
                    <p>No attendance records yet</p>
                  )}
                </div>
              </>
            ) : (
              <p>No analytics available.</p>
            )}
          </article>
        </section>

        {message && (
          <p className={`message ${message.includes('✓') ? 'success' : 'error'}`}>{message}</p>
        )}
      </div>
    )
  }

  // ===== Render student dashboard =====
  return (
    <div className="app-shell">
      <header>
        <h1>Student Dashboard</h1>
        <p>Welcome, {user.full_name}</p>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </header>

      <section className="layout-grid">
        <article className="panel">
          <h2>Active Classes</h2>
          {activeSessions.length === 0 ? (
            <p>No active classes at the moment</p>
          ) : (
            <div className="sessions-list">
              {activeSessions.map((session) => (
                <div key={session.id} className="session-item">
                  <h3>
                    {session.course?.name ||
                      courses.find((c) => c.id === session.course_id)?.name ||
                      `Course ${session.course_id}`}
                  </h3>
                  <p>{session.description || 'Class in progress'}</p>
                  <button
                    onClick={() => handleJoinSession(session.session_key)}
                    className="join-btn"
                  >
                    Join Class (Mark Attendance)
                  </button>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel">
          <div className="qr-header-row">
            <div>
              <h2>Scan QR Code</h2>
              <p className="hint-text">
                {isMobile
                  ? 'Open the scan lens to use your phone or tablet camera. Once the QR code is recognized, attendance will be marked automatically.'
                  : 'QR camera scanning is available on phone and tablet only. Use the manual entry below if you are on desktop.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowScanner((prev) => !prev)}
              disabled={!isMobile}
              className="secondary-btn"
            >
              {showScanner ? 'Close Scan Lens' : 'Open Scan Lens'}
            </button>
          </div>

          {showScanner && isMobile && (
            <div id="qr-reader" className="qr-reader" />
          )}

          <form onSubmit={handleScanQR} className="form-stack">
            <label>
              Session Key
              <textarea
                value={scanData}
                onChange={(e) => setScanData(e.target.value)}
                placeholder="e.g., session:abc123def456"
                rows={3}
              />
            </label>
            <button type="submit">Record Attendance</button>
          </form>
        </article>
      </section>

      {message && (
        <p className={`message ${message.includes('✓') ? 'success' : 'error'}`}>{message}</p>
      )}
    </div>
  )
}

export default App