# CloudSentinel

CloudSentinel is an AI-powered cloud security, threat detection, and incident response platform designed for AWS environments. It ingests security events, detects suspicious activity, calculates explainable risk scores, correlates related alerts into incidents, and supports incident investigation and response.

## Architecture & Vision

CloudSentinel follows a modular architecture that separates event ingestion, threat detection, risk assessment, alert management, incident correlation, and the user interface.

### Core Capabilities

- **Security Event Ingestion:** Accepts normalized security events from simulated sources and supports integration with AWS CloudTrail-style events.
- **Persistent Storage:** Uses PostgreSQL to store security events, alerts, incidents, and related records.
- **Idempotent Processing:** Helps prevent duplicate processing of the same event.
- **Deterministic Threat Detection:** Applies explicit detection rules to identify suspicious activity.
- **Explainable Risk Scoring:** Assigns risk scores based on detection results and event context.
- **Alert Management:** Stores and manages security alerts while reducing duplicate alerts.
- **Incident Correlation:** Groups related alerts into incidents using contextual information.
- **Incident Lifecycle Management:** Supports incident status changes and tracks investigation progress.
- **Audit History:** Records incident transitions and analyst actions for accountability.
- **Security Dashboard:** Provides a React-based interface for viewing security information.
- **AI-Assisted Investigation:** Establishes a foundation for using AI to summarize evidence and assist analysts. AI-generated recommendations should support, rather than replace, deterministic security controls and analyst judgment.

## Technology Stack

| Component | Technology |
|---|---|
| Backend API | Python, FastAPI |
| Frontend | React, TypeScript |
| Database | PostgreSQL |
| AWS Integration | Boto3 and AWS APIs |
| Local Development | Docker and Docker Compose |
| API Documentation | FastAPI OpenAPI / Swagger UI |

The exact availability of each integration depends on the current implementation and configuration.

## Project Structure

```text
CloudSentinel/
├── backend/
│   └── app/
│       └── main.py
├── frontend/
├── docs/
│   └── development-setup.md
├── docker-compose.yml
├── README.md
└── ...
```

The repository may contain additional modules and files as development continues.

## Getting Started

### Prerequisites

Install the following tools before running the project:

- Git
- Python 3.11 or a compatible version supported by the project
- Node.js and npm
- Docker Desktop with Docker Compose
- PostgreSQL, if you are not using the database provided by Docker Compose

### 1. Clone the Repository

```powershell
git clone https://github.com/Ritwiz18/Cloudsentinel.git
cd Cloudsentinel
```

If the repository is already on your computer, open PowerShell in the existing project directory instead of cloning it again.

### 2. Review the Development Setup

Read the development setup guide:

```text
docs/development-setup.md
```

Follow the environment-variable, database, and dependency instructions defined by the project.

### 3. Configure Environment Variables

Create the environment file required by the application, if the project provides an example file.

For example, if `.env.example` exists:

```powershell
Copy-Item .env.example .env
```

Update the values in `.env` for your local environment. Never commit real AWS credentials, passwords, API keys, or other secrets to GitHub.

### 4. Start the Application

If the repository's Docker Compose configuration includes the required services, start them from the project root:

```powershell
docker compose up --build
```

If the application is not configured to run entirely through Docker Compose, follow the instructions in `docs/development-setup.md` to start the backend, frontend, and database separately.

### 5. Open the Backend API Documentation

When the FastAPI backend is running on its default local port, open:

- API documentation: http://localhost:8000/docs
- Alternative API documentation: http://localhost:8000/redoc

The available endpoints depend on the current backend implementation.

## Detection Rules Catalog

The detection engine is intended to identify suspicious cloud activity using explicit, explainable rules. Examples of detection scenarios include:

- Unusual or suspicious authentication activity.
- Repeated failed authentication attempts.
- Unexpected changes to cloud security configurations.
- Suspicious privilege or access-policy changes.
- Potentially risky activity involving cloud resources.

These are example detection scenarios, not a guarantee that every rule is already implemented. Refer to the current source code and tests for the rules that are actually active.

Each detection should ideally provide:

- A rule identifier and description.
- The relevant event or evidence.
- A severity or risk classification.
- An explainable reason for the detection.
- Context useful for investigating the alert.

## Incident Management

CloudSentinel is designed to correlate related alerts into incidents so analysts can investigate a sequence of potentially connected security events.

Incident management may include:

- Incident creation and correlation.
- Aggregated risk assessment.
- Incident status tracking.
- Analyst assignment.
- Resolution or false-positive classification.
- A history of incident status transitions and investigation actions.

Incident transitions should be validated by the backend. In particular, resolving an incident or marking it as a false positive should require an explicit resolution reason.

## Security Principles

CloudSentinel is developed with the following security principles in mind:

- **Least Privilege:** AWS access should be restricted to the permissions required by the application.
- **Secret Management:** Credentials and sensitive configuration must not be committed to source control.
- **Input Validation:** API requests and incoming security events should be validated before processing.
- **Explainability:** Detection results should include understandable reasons and supporting evidence.
- **Data Integrity:** Persistent security records should be handled consistently and protected against accidental duplication.
- **Audit Logging:** Incident status transitions and analyst assignments should produce traceable audit records. Transitioning an incident to `RESOLVED` or `FALSE_POSITIVE` should require an explicit resolution reason.
- **Safe Investigation:** Automated recommendations should not silently perform destructive actions or replace required human approval.

## Development Guidelines

When contributing to CloudSentinel:

1. Keep detection logic separate from API routing where practical.
2. Validate inputs at system boundaries.
3. Add tests for new detection rules and incident lifecycle changes.
4. Avoid logging credentials, access tokens, or unnecessary personal information.
5. Document new environment variables and API endpoints.
6. Keep the README aligned with functionality that is actually implemented.
7. Review changes before committing or pushing them to GitHub.

## Project Status

CloudSentinel is under active development. Features, integrations, and setup instructions may change as the project evolves. Consult the source code, tests, and development documentation to confirm which capabilities are currently implemented.

## License

A license has not been specified in this README. Add a `LICENSE` file and update this section when the project license has been selected.