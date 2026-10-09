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

The database port is bound to `127.0.0.1:5432` to avoid exposing it to your local network.

---

## Step 3: Configure Backend Python Virtual Environment

```bash
cd backend

# Create virtual environment
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

## Step 4: Run Backend Service

From the `backend` directory with `.venv` active:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Verify the service:
- Health endpoint: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- Interactive API documentation (Swagger UI): [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## Step 5: Run Automated Tests

Execute backend tests using pytest:

```bash
pytest -v
```
