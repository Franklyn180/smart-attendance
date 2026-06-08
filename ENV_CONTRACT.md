# ENV_CONTRACT.md — Group 9 — Shared Environment Contract
## Smart Attendance Management System

**Owner:** Sub-Team C — GitOps & CI/CD  
**Status:** LOCKED — Week 1  
**Last Updated:** Week 1 Sprint  

> ⚠️ This file is the single source of truth for the entire project.
> Any change to this file requires a pull request reviewed and approved by Sub-Team C before merging.
> Sub-Team A must read this before writing any code.
> Sub-Team B must read this before configuring the server.

---

## 1. Environment Variables

These are all the variable names the application uses. Use these exact names — do not invent new ones.

### Database Variables

| Variable Name | Correct Value | Where It Is Used |
|---|---|---|
| `DB_HOST` | `database` | `backend/database.py` — must match the MySQL container_name |
| `DB_NAME` | `attendance_db` | `backend/database.py` |
| `DB_USER` | `attendance_user` | `backend/database.py` |
| `DB_PASSWORD` | stored in GitHub Secrets | `backend/database.py` — never hardcode this |
| `MYSQL_ROOT_PASSWORD` | stored in GitHub Secrets | `docker-compose.yml` — never hardcode this |

### Application Variables

| Variable Name   | Correct Value |              Where It Is Used        |
|-----------------|---------------|--------------------------------------|
| `BACKEND_PORT`  | `8000`        | `docker-compose.yml`, Nginx (Week 3) |
| `FRONTEND_PORT` | `5173`        | `docker-compose.yml`, Vite config    |

### Attendance Session & Cryptographic Security Variables

| Variable Name | Correct/Default Value | Where It Is Used / Purpose |
|---|---|---|
| `JWT_SECRET_KEY` | stored in GitHub Secrets | `backend/auth.py` — Used to cryptographically sign student/instructor session tokens. |
| `JWT_ALGORITHM` | `HS256` | `backend/auth.py` — Hashing algorithm for secure user login tokens. |
| `ATTENDANCE_WINDOW_MINUTES` | `20` | `backend/routes/attendance.py` — Enforces the strict 20-minute timeframe for both physical and online students. |
| `ONLINE_SESSION_ID_LENGTH` | `8` | `backend/utils.py` — Length of the alphanumeric random ID code generated for online students. |

### Monitoring Variables (activate in Week 3)

| Variable Name     | Correct Value | Where It Is Used     |
|-------------------|---------------|----------------------|
| `PROMETHEUS_PORT` |     `9090`    | `docker-compose.yml` |
| `GRAFANA_PORT`    |     `3001`    | `docker-compose.yml` |
| `CADVISOR_PORT`   |     `8080`    | `docker-compose.yml` |

---

## 2. Port Mappings

Sub-Team B uses this table to configure AWS Security Group rules.
Sub-Team A uses this to set ports in `docker-compose.yml`.

|    Service   | Container Port |    Host Port   | Exposed to Internet? |    AWS Security Group Rule    |
|--------------|----------------|----------------|----------------------|--------------------------------|
| `frontend`   |      5173      | 5173           | Dev only             | Open port 5173 to team IPs only |
| `backend`    |      8000      | 8000           | Via Nginx in Week 3  | Open port 8000 to team IPs only |
| `database`   |      3306      | ❌ NOT expose  | NO — never           | Do NOT open port 3306. Ever.     |
| `prometheus` |      9090      | 9090           | Week 3 only          | Open port 9090 to team IPs only |
| `grafana`    |      3001      | 3001           | Week 3 only          | Open port 3001 to team IPs only |
| `cadvisor`   |      8080      | 8080           | Week 3 only          | Open port 8080 to team IPs only |
| `nginx`      |    80 / 443    | 80 / 443       | YES — public         | Open ports 80 and 443 to everyone |

---

## 3. Naming Conventions

Use these exact names in `docker-compose.yml` and all server scripts. Do not change them.

### Container Names

| Service | container_name value |
|---|---|
| MySQL database | `database` |
| FastAPI backend | `app_backend` |
| React frontend | `app_frontend` |
| Prometheus | `prometheus` |
| Grafana | `grafana` |
| cAdvisor | `cadvisor` |

### Network Names

|            Network           |         Name         |
|------------------------------|----------------------|
| Main application network     |    `app_network`     |
| Monitoring network           | `monitoring_network` |

### Volume Names

|      Volume     |       Name        |
|-----------------|-------------------|
| MySQL data      |      `db_data`     |
| Prometheus data | `prometheus_data` |
| Grafana data    |   `grafana_data`  |

---

## 4. GitHub Secrets

These secrets must exist in GitHub → Settings → Secrets and variables → Actions.
Sub-Team C is responsible for adding and managing them.

| Secret Name           | Who Uses It        | What it does |
|-----------------------|--------------------|-----------------------------|
| `EC2_HOST`            | GitHub Actions     | IP address of your AWS server |
| `EC2_USERNAME`        | GitHub Actions     | SSH username (e.g., ubuntu) |
| `SSH_PRIVATE_KEY`     | GitHub Actions     | Key used to log into the server automatically |
| `DB_PASSWORD`         | docker-compose.yml | Password for the application database user |
| `MYSQL_ROOT_PASSWORD` | docker-compose.yml | Administrative root password for MySQL |
| `DB_USER`             | docker-compose.yml | Username for the database user |
| `DB_NAME`             | docker-compose.yml | Name of the database schema |
| `JWT_SECRET_KEY`      | backend auth logic | Cryptographic salt used to ensure user login tokens can't be forged |

---

## 5. Core Operational Session Contracts

To avoid pipeline validation failures during Week 2 integration testing, Sub-Team A's API logic must strictly respect the following architectural validation rules:

1. **The 20-Minute Boundary (`ATTENDANCE_WINDOW_MINUTES`):** When an instructor initializes an attendance session, the backend must save a `created_at` timestamp and an `expires_at` timestamp calculated precisely as `created_at + 20 minutes`. Any student payload arriving after `expires_at` must return an HTTP status code `410 Gone` and log the student as **Absent**.
2. **Online Token Format (`ONLINE_SESSION_ID_LENGTH`):** The random ID generated for online students must be a string containing exactly 8 alphanumeric characters (uppercase A-Z, numbers 0-9). The integration testing suite will explicitly check for string length constraints.
3. **QR Code Payload Structure:** The QR code generated on the instructor monitor for physical students must encapsulate a transient cryptographically signed JWT payload matching `{"session_id": "string", "type": "physical", "timestamp": "float"}` to prevent students from sharing static screenshots outside the classroom.

---

## 6. Sign-Off

All three sub-team members must confirm they have read this contract before starting Week 1 work.
