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
| `FRONTEND_PORT` | `5173`        | `docker-compose.yml`, Vite config ---|

### Monitoring Variables (activate in Week 3)

| Variable Name     | Correct Value | Where It Is Used     |
|-------------------|---------------|----------------------|
| `PROMETHEUS_PORT` |     `9090`    | `docker-compose.yml` |
| `GRAFANA_PORT`    |     `3001`    | `docker-compose.yml` |
| `CADVISOR_PORT`   |     `8080`    | `docker-compose.yml` |

---

## 2. Port Mappings

Sub-Team B uses this table to configure AWS Security Group rules.
Sub-Team A uses this to set ports in docker-compose.yml.

|    Service   | Container Port |    Host Port   | Exposed to Internet? |     AWS Security Group Rule    |
|--------------|----------------|----------------|----------------------|--------------------------------|
| `frontend`   |      5173      | 5173           | Dev only             | Open port 5173 to team IPs only |
| `backend`    |      8000      | 8000           | Via Nginx in Week 3  | Open port 8000 to team IPs only |
| `database`   |      3306      | ❌ NOT expose  | NO — never           | Do NOT open port 3306. Ever.     |
| `prometheus` |      9090      | 9090           | Week 3 only          | Open port 9090 to team IPs only |
| `grafana`    |      3001      | 3001           | Week 3 only          | Open port 3001 to team IPs only |
| `cadvisor`   |      8080      | 8080           | Week 3 only          | Open port 8080 to team IPs only |
| `nginx`      |    80 / 443    | 80 / 443       | YES — public          | Open ports 80 and 443 to everyone |

---

## 3. Naming Conventions

Use these exact names in docker-compose.yml and all server scripts. Do not change them.

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

|            Network       |         Name         |
|--------------------------|----------------------|
| Main application network |    `app_network`     |
| Monitoring network       | `monitoring_network` |

### Volume Names

|      Volume     |       Name        |
|-----------------|-------------------|
| MySQL data      |     `db_data`     |
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

---

## 5. Sign-Off

All three sub-teams must confirm they have read this contract before starting Week 1 work.

