# CloudSentinel

CloudSentinel is an AI-powered cloud security, threat detection, and incident response platform tailored for AWS environments.

## Architecture & Vision

CloudSentinel is designed with a defense-in-depth security approach:
- **Event Ingestion**: Normalizes simulated and real AWS CloudTrail/security events into a canonical security schema.
- **Deterministic Detection Engine**: Executes configurable, rule-based Python detections to identify suspicious behaviors (e.g., unauthorized privilege escalations, root account activity, anomalous network egress).
- **Incident Correlation**: Correlates related alerts into prioritized incidents with severity scoring.
- **Analyst Dashboard**: Modern React interface providing visibility into events, alerts, and active security incidents.
- **AI-Assisted Investigation**: Leverages LLMs to provide context summaries, MITRE ATT&CK mapping, and structured remediation recommendations (without destructive automated actions).

---

## Project Structure

```text
CloudSentinel/
├── backend/            # FastAPI REST API & Ingestion engine
│   ├── app/            # Application source (main, api, models, schemas, services)
│   ├── tests/          # Automated backend test suite
│   └── requirements.txt
├── detection/          # Deterministic detection rules & rule tests
├── frontend/           # React + TypeScript security dashboard
├── database/           # PostgreSQL migrations & schemas
├── simulator/          # Attack simulation & synthetic event generation
├── infra/              # Infrastructure-as-Code (Terraform)
├── docs/               # Architecture, API specifications, and setup guides
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

### 3. Backend Setup
```bash
cd backend
python -m venv .venv

# On Windows PowerShell:
.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Verify backend health:
```bash
curl http://127.0.0.1:8000/health
```

### 4. Run Backend Tests
```bash
pytest
```

---

## Security Principles
- **Principle of Least Privilege**: Local services bind only to `127.0.0.1` and AWS IAM roles adhere strictly to least-privilege policies.
- **Zero Hardcoded Secrets**: Secrets and configurations are loaded via environment variables and excluded from source control.
- **Deterministic First**: AI assists with enrichment and triage, never replacing deterministic detection rules. No automated destructive actions are executed.
