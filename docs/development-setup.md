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

This establishes the `security_events` and `security_alerts` tables with optimized indexes in PostgreSQL.

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

## Step 7: Run Threat Detection Engine & Query Alerts

Once events are ingested into the database, trigger the detection evaluation run:

```powershell
# Run detections on stored events (PowerShell)
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/detections/run" -Method Post -ContentType "application/json" -Body '{"lookback_minutes": 120}'

# List active alerts
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/alerts"

# Filter by severity
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/alerts?severity=CRITICAL"
```

Via cURL:
```bash
curl -X POST http://127.0.0.1:8000/api/v1/detections/run -H "Content-Type: application/json" -d '{"lookback_minutes": 120}'
curl "http://127.0.0.1:8000/api/v1/alerts?severity=CRITICAL"
```

---

## Step 8: Run Automated Tests

Execute the complete backend test suite using pytest from the `backend` directory:

```bash
cd backend
pytest -v
```

All tests execute against an isolated in-memory test database and do not mutate your local development database.
