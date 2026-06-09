# Smart Attendance Management Backend

This backend service is built with FastAPI and MySQL. It provides APIs for student registration, course management, QR-code attendance scanning, and analytics.

## Setup

1. Create a Python virtual environment:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Copy the example configuration and update it for your MySQL database:

```bash
cp .env.example .env
```

4. Start the backend service from the repository root:

```bash
uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

- `GET /api/health`
- `GET /api/students`
- `POST /api/students`
- `GET /api/courses`
- `POST /api/courses`
- `POST /api/attendance/scan`
- `GET /api/analytics`
