# CloudSentinel

CloudSentinel is an AI-powered cloud security, threat detection, and incident response platform tailored for AWS environments.

## Architecture & Vision

CloudSentinel is designed with a defense-in-depth security approach:
- **Event Ingestion**: Normalizes simulated and real AWS CloudTrail/security events into a canonical security schema with ACID PostgreSQL persistence and idempotency guarantees.
- **Deterministic Detection Engine**: Executes configurable, rule-based Python detections to identify suspicious behaviors (e.g., unauthorized privilege escalations, root account activity, anomalous network egress).
- **Incident Correlation**: Correlates related alerts into prioritized incidents with severity scoring.
- **Analyst Dashboard**: Modern React interface providing visibility into events, alerts, and active security incidents.
- **AI-Assisted Investigation**: Leverages LLMs to provide context summaries, MITRE ATT&CK mapping, and structured remediation recommendations (without destructive automated actions).

---

## Project Structure

```text
CloudSentinel/
├── backend/            # FastAPI REST API & Ingestion engine
│   ├── app/            # Application source (core, db, models, schemas, services, api)
│   ├── tests/          # Automated backend test suite
│   ├── pytest.ini      # Test configuration
│   └── requirements.txt
├── detection/          # Deterministic detection rules & rule tests
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
- API Contract Documentation: [docs/api-contract.md](docs/api-contract.md)

### 5. Generate Synthetic Events
From the project root:
```bash
# Preview synthetic events (dry run):
python -m simulator.runner --scenario auth --dry-run

# Dispatch events to the API:
python -m simulator.runner --scenario all
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
- **Deterministic First**: AI assists with enrichment and triage, never replacing deterministic detection rules. No automated destructive actions are executed.
- **Idempotent Ingestion**: Event IDs are validated for uniqueness to prevent alert storms and duplicate processing.
