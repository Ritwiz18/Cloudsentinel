# Local Development Setup Guide

This guide walks through setting up the local CloudSentinel development environment.

## System Prerequisites

Ensure you have the following installed on your machine:
- **Python**: 3.12 or 3.13
- **Docker**: Docker Desktop (Engine 20+) with Docker Compose
- **Node.js**: v20 or higher (for frontend development)
- **Git**: 2.30+

---

## Step 1: Clone Repository & Configure Environment

```bash
cd cloudsentinel
cp .env.example .env
```

Review `.env` to customize local ports or credentials if necessary. The defaults work out-of-the-box for local testing.

---

## Step 2: Start Local PostgreSQL via Docker Compose

Start the PostgreSQL service in detached mode:

```bash
docker compose up -d postgres
```

Verify the container is running and healthy:

```bash
docker compose ps
```

The database port is bound strictly to `127.0.0.1:5432` to avoid exposing it to your local network.

---

## Step 3: Configure Backend Python Virtual Environment

```bash
cd backend

# Create virtual environment (if not already created)
python -m venv .venv

# Activate virtual environment
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

# Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

---

## Step 4: Apply Database Migrations (Alembic)

From the project root with your virtual environment active:

```bash
alembic upgrade head
```

This applies migrations:
- `001_create_security_events_table`: Canonical event ingestion store
- `002_create_security_alerts_table`: Deduplicated security alerts store
- `003_create_incidents_table`: Correlated security incidents and append-only audit ledger

---

## Step 5: Run Backend Service

From the `backend` directory with `.venv` active:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Verify the service:
- Health endpoint: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- Interactive API documentation (Swagger UI): [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- OpenAPI JSON: [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json)

---

## Step 6: Generate & Ingest Synthetic Security Events

From the project root:

```bash
# Preview synthetic events (dry run):
python -m simulator.runner --scenario auth --dry-run

# Dispatch all synthetic scenarios to the live API:
python -m simulator.runner --scenario all
```

---

## Step 7: Run Threat Detections & Correlate Incidents

Once events are ingested into the database, trigger threat detection and correlation:

```powershell
# 1. Run detections on stored events
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/detections/run" -Method Post -ContentType "application/json" -Body '{"lookback_minutes": 120}'

# 2. Correlate related alerts into incidents
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/incidents/correlate" -Method Post -ContentType "application/json" -Body '{"lookback_minutes": 120, "window_minutes": 60}'

# 3. List open incidents
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/incidents?status=OPEN"

# 4. Investigate and resolve an incident (resolution_reason required)
$body = @{ status = "RESOLVED"; resolution_reason = "Revoked unauthorized AdministratorAccess" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/incidents/<incident_id>" -Method Patch -ContentType "application/json" -Body $body
```

---

## Step 8: Run Automated Tests

Execute the complete backend test suite using pytest from the `backend` directory:

```bash
cd backend
pytest -v
```

All 33 tests execute against an isolated in-memory test database and do not mutate your local development database.

---

## Step 9: Launch the Frontend Analyst Dashboard

The CloudSentinel Analyst Dashboard is a React + TypeScript single-page application built on Vite.

### 1. Install Frontend Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment (Optional)
By default, the dashboard connects to `http://localhost:8000`. To customize the backend URL, create a `.env` file in `frontend/`:
```env
VITE_API_BASE_URL=http://localhost:8000
```

### 3. Start Frontend Development Server
```bash
npm run dev
```
The dashboard will be available at `http://localhost:5173`.

### 4. Run Frontend Automated Tests & Build
```bash
# Run unit and integration tests (15 passing tests)
npm test

# Run linter
npm run lint

# Production build and type-checking
npm run build
```

### 5. Full End-to-End Workflow in Dashboard
1. Ensure PostgreSQL and FastAPI backend are running on `http://localhost:8000`.
2. Start the Vite dashboard on `http://localhost:5173`.
3. In terminal, dispatch synthetic security scenarios:
   ```bash
   python -m simulator.runner --scenario all
   ```
4. In the dashboard:
   - **Overview**: View live counts of Events, Open Incidents, Open Alerts, and Severity Distribution.
   - **Security Events**: Inspect raw canonical payloads, timestamps, actors, and synthetic tags.
   - **Operations & Tools**: Click **Execute Threat Detection** to evaluate rules and create alerts.
   - **Alerts**: Review triggered rules, risk scores, diagnostic evidence, and related events.
   - **Operations & Tools**: Click **Execute Incident Correlation** to cluster alerts by actor/IP/resource.
   - **Incidents**: Click an incident to open the investigation drawer, review correlated alerts, and update lifecycle status (requiring resolution reason for `RESOLVED` / `FALSE_POSITIVE`).
