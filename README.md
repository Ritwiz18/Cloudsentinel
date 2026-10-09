# CloudSentinel

CloudSentinel is an AI-powered cloud security, threat detection, and incident response platform tailored for AWS environments.

## Architecture & Vision

CloudSentinel is designed with a defense-in-depth security approach:
- **Event Ingestion**: Normalizes simulated and real AWS CloudTrail/security events into a canonical security schema with ACID PostgreSQL persistence and idempotency guarantees.
- **Deterministic Detection Engine**: Evaluates ingested events against modular, rule-based Python detections to identify suspicious behaviors (e.g., repeated authentication bursts, administrative IAM privilege grants, S3 public access block deletions).
- **Explainable Risk Scoring**: Deterministically calculates 0-100 risk scores and assigns explicit severity bands (`INFORMATIONAL`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) with audit trails.
- **Deduplicated Alert Store**: Persists actionable alerts with stable fingerprints to prevent alert fatigue and redundant duplicate records across re-evaluation runs.
- **Analyst Dashboard**: Modern React interface providing visibility into events, alerts, and active security incidents.
- **AI-Assisted Investigation**: Leverages LLMs to provide context summaries, MITRE ATT&CK mapping, and structured remediation recommendations (without destructive automated actions).

---

## Detection Rules Catalog (Initial Phase)

| Rule ID | Rule Name | Target Classification | Severity Band | Description |
| :--- | :--- | :--- | :--- | :--- |
| `AUTH-001` | Repeated Authentication Failures | `Authentication` / `FAILURE` | `MEDIUM` - `HIGH` | Identifies clustered failed authentication attempts for an actor/IP within a sliding time window. |
| `IAM-001` | Risky IAM Policy Modification | `IAMPolicyChange` / `SUCCESS` | `HIGH` - `CRITICAL` | Detects `AdministratorAccess` policy attachments and wildcard `*` assume-role trust relationships. |
| `STORAGE-001` | Risky Storage Configuration Change | `StorageConfiguration` / `SUCCESS` | `HIGH` - `CRITICAL` | Detects S3 Block Public Access deletion and `public-read` bucket ACL assignments. |
| `BENIGN-001` | Benign Activity Allowlist Filter | Read-only APIs (`EC2Read`, `StorageRead`, `STSRead`) | None | Explicitly prevents routine queries (`DescribeInstances`, `ListBuckets`, `GetCallerIdentity`) from generating false alerts. |

---

## Project Structure

```text
CloudSentinel/
├── backend/            # FastAPI REST API, Detection Engine, & Ingestion
│   ├── app/
│   │   ├── api/v1/     # REST routers: events, detections, alerts
│   │   ├── core/       # Configuration & settings
│   │   ├── db/         # Async database sessions & Base
│   │   ├── detection/  # Threat detection engine, risk model, & rules
│   │   │   ├── rules/  # Modular rule definitions (AUTH, IAM, STORAGE, BENIGN)
│   │   │   ├── engine.py
│   │   │   ├── risk_model.py
│   │   │   └── service.py
│   │   ├── models/     # SQLAlchemy models: SecurityEvent, SecurityAlert
│   │   ├── schemas/    # Pydantic schemas: EventCreate, AlertResponse, etc.
│   │   └── services/   # Business services
│   ├── tests/          # Automated backend test suite (22 tests)
│   ├── pytest.ini      # Test configuration
│   └── requirements.txt
├── detection/          # Standalone detection rules & testing artifacts
├── frontend/           # React + TypeScript security dashboard
├── database/           # PostgreSQL migrations & schemas (Alembic)
│   └── migrations/     # Version-controlled schema migrations
├── simulator/          # Attack simulation & synthetic event generation
│   ├── scenarios/      # Reproducible test scenarios and JSON fixtures
│   ├── generator.py    # Scenario event generation engine
│   └── runner.py       # CLI runner to dispatch events to API
├── infra/              # Infrastructure-as-Code (Terraform)
├── docs/               # Architecture, API specifications, and setup guides
│   ├── architecture.md
│   ├── api-contract.md
│   └── development-setup.md
├── compose.yaml        # Local development container orchestration
├── .env.example        # Environment variable template
└── README.md
```

---

## Quickstart

### Prerequisites
- Python 3.12+ (Python 3.13 supported)
- Node.js 20+
- Docker & Docker Compose
- Git

### 1. Clone & Set Environment
```bash
git clone <repo-url> cloudsentinel
cd cloudsentinel
cp .env.example .env
```

### 2. Start PostgreSQL via Docker Compose
```bash
docker compose up -d postgres
```

### 3. Backend Setup & Migrations
```bash
cd backend
python -m venv .venv

# On Windows PowerShell:
.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt

# Run migrations from project root (with venv active)
cd ..
alembic upgrade head
```

### 4. Run the API Service
```bash
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Verify service:
- Health check: `curl http://127.0.0.1:8000/health`
- Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- API Contract: [docs/api-contract.md](docs/api-contract.md)

### 5. Generate Events & Run Threat Detections
From the project root:
```bash
# 1. Ingest synthetic security events across scenarios
python -m simulator.runner --scenario all

# 2. Trigger threat detection evaluation run (PowerShell)
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/detections/run" -Method Post -ContentType "application/json" -Body '{"lookback_minutes": 120}'

# 3. Retrieve correlated security alerts
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/alerts"
```

### 6. Run Automated Tests
```bash
cd backend
pytest -v
```

---

## Security Principles
- **Principle of Least Privilege**: Local services bind only to `127.0.0.1` and AWS IAM roles adhere strictly to least-privilege policies.
- **Zero Hardcoded Secrets**: Secrets and configurations are loaded via environment variables and excluded from source control.
- **Deterministic First**: Threat detections run on deterministic rules with audit trails. AI assists with investigation and triage, never replacing rules. No automated destructive actions are executed.
- **Idempotent Ingestion & Deduplicated Alerting**: Event IDs are validated for uniqueness and alerts are grouped by stable fingerprints to prevent alert storms.
