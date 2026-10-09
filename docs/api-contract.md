# CloudSentinel API Contract (v1)

This document specifies the REST API contract for CloudSentinel.

---

## 1. System Endpoints

### `GET /health`
Returns service operational health and current UTC timestamp.

- **Request**: `GET /health`
- **Response (200 OK)**:
```json
{
  "status": "healthy",
  "service": "cloudsentinel-api",
  "timestamp": "2026-10-09T16:00:00.000000+00:00",
  "version": "0.1.0"
}
```

---

## 2. Security Events Endpoints

Base path: `/api/v1/events`

### `POST /api/v1/events`
Ingests, validates, and persists a canonical security event. Enforces idempotency via unique `event_id`.

- **Headers**: `Content-Type: application/json`
- **Request Body Fields**:
  - `event_id` (string, required, 1-128 chars): Unique event ID or UUID.
  - `source` (string, required, 1-64 chars): Origin of event (e.g. `simulator`, `aws.cloudtrail`).
  - `event_type` (string, required, 1-64 chars): Classification category (e.g. `Authentication`, `IAMPolicyChange`, `StorageAccess`).
  - `timestamp` (string ISO-8601, required): Event occurrence time in UTC.
  - `account_id` (string, optional, max 64 chars): Cloud provider account identifier.
  - `region` (string, optional, max 32 chars): AWS/Cloud region (e.g. `us-east-1`).
  - `actor` (string, optional, max 128 chars): Principal, IAM ARN, or username.
  - `source_ip` (string, optional, max 64 chars): IP address originating the request.
  - `resource` (string, optional, max 256 chars): Target resource ARN or URI.
  - `outcome` (string, required, 1-32 chars): `SUCCESS`, `FAILURE`, or `DENIED`.
  - `metadata` (object, optional): Structured context or telemetry dictionary.

#### Response (201 Created):
```json
{
  "id": 1,
  "event_id": "syn-auth-fail-a1b2c3d4e5f6",
  "source": "simulator",
  "event_type": "Authentication",
  "timestamp": "2026-10-09T16:05:00+00:00",
  "account_id": "112233445566",
  "region": "us-east-1",
  "actor": "arn:aws:iam::112233445566:user/analyst-bob",
  "source_ip": "203.0.113.195",
  "resource": "arn:aws:iam::112233445566:root",
  "outcome": "FAILURE",
  "metadata": {
    "is_synthetic": true,
    "scenario": "repeated_failed_authentication"
  },
  "ingested_at": "2026-10-09T16:05:01.123456+00:00"
}
```

---

### `GET /api/v1/events`
Returns a paginated list of security events ordered by ingestion time (newest first).

- **Query Parameters**:
  - `limit` (integer, default: 20, min: 1, max: 100): Page limit.
  - `offset` (integer, default: 0, min: 0): Page offset.
  - `event_type` (string, optional): Filter by event classification.
  - `source` (string, optional): Filter by origin source.
  - `outcome` (string, optional): Filter by result status.

---

### `GET /api/v1/events/{event_id}`
Retrieves a single security event by its unique string identifier.

---

## 3. Threat Detection Endpoints

Base path: `/api/v1/detections`

### `POST /api/v1/detections/run`
Executes detection rules across stored events within a bounded time window, correlates indicators, deduplicates against open alerts, and persists newly discovered or updated alerts.

- **Request Body (optional JSON)**:
  - `limit` (integer, default: 100, max: 500): Events to evaluate.
  - `lookback_minutes` (integer, default: 60, max: 1440): Lookback boundary.
  - `real_only` (boolean, default: false): Ignore synthetic events if true.
  - `auth_threshold` (integer, optional): Override threshold for auth failures.
  - `auth_window_minutes` (integer, optional): Override sliding window for auth failures.

#### Response (200 OK):
```json
{
  "events_evaluated": 13,
  "alerts_created": 4,
  "alerts_updated": 0,
  "rules_evaluated": 4,
  "errors": []
}
```

---

## 4. Security Alerts Endpoints

Base path: `/api/v1/alerts`

### `GET /api/v1/alerts`
Retrieves a paginated list of security alerts ordered newest first, with optional filtering.

- **Query Parameters**:
  - `limit` (integer, default: 20, min: 1, max: 100)
  - `offset` (integer, default: 0, min: 0)
  - `severity` (string, optional): `INFORMATIONAL`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
  - `rule_id` (string, optional): e.g. `AUTH-001`, `IAM-001`, `STORAGE-001`
  - `status` (string, optional): `OPEN`, `INVESTIGATING`, `RESOLVED`, `FALSE_POSITIVE`

---

### `GET /api/v1/alerts/{alert_id}`
Retrieves a single alert by its external identifier.

---

## 5. Security Incidents Endpoints

Base path: `/api/v1/incidents`

### `POST /api/v1/incidents/correlate`
Executes event correlation across stored alerts, grouping related findings into incident clusters and appending audit trail logs.

- **Request Body (optional JSON)**:
  - `lookback_minutes` (integer, default: 120, max: 1440): Temporal lookback boundary.
  - `window_minutes` (integer, default: 60, max: 240): Maximum span between correlated alerts.
  - `status_filter` (string, default: "OPEN"): Target alert status to correlate.

#### Response (200 OK):
```json
{
  "alerts_evaluated": 9,
  "incidents_created": 2,
  "incidents_updated": 0,
  "errors": []
}
```

---

### `GET /api/v1/incidents`
Returns a paginated list of security incidents with optional filtering.

- **Query Parameters**:
  - `limit` (integer, default: 20, min: 1, max: 100)
  - `offset` (integer, default: 0, min: 0)
  - `status` (string, optional): `OPEN`, `INVESTIGATING`, `RESOLVED`, `FALSE_POSITIVE`
  - `severity` (string, optional): `INFORMATIONAL`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
  - `assigned_analyst` (string, optional): Filter by assigned analyst

#### Response (200 OK):
```json
{
  "items": [
    {
      "id": 1,
      "incident_id": "inc-4a7b2c9d1e3f",
      "title": "Suspicious Activity Cluster on Principal arn:aws:iam::112233445566:user/compromised-contractor",
      "summary": "Correlated incident involving 2 alerts across 2 distinct detection rules: IAM-001, STORAGE-001.",
      "severity": "CRITICAL",
      "risk_score": 100,
      "status": "OPEN",
      "correlation_fingerprint": "INC:actor:112233445566:arn:aws:iam::112233445566:user/compromised-contractor",
      "related_alert_ids": ["alt-123", "alt-456"],
      "related_event_ids": ["evt-101", "evt-102"],
      "correlation_reasons": [
        "Linked by shared actor principal: arn:aws:iam::112233445566:user/compromised-contractor",
        "Target cloud account scope: 112233445566",
        "Temporal clustering within 60-minute correlation window"
      ],
      "first_seen": "2026-10-09T16:10:00+00:00",
      "last_seen": "2026-10-09T16:15:00+00:00",
      "assigned_analyst": null,
      "resolution_reason": null,
      "created_at": "2026-10-09T16:20:00+00:00",
      "updated_at": "2026-10-09T16:20:00+00:00"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

### `GET /api/v1/incidents/{incident_id}`
Retrieves complete incident details including its chronological audit history.

#### Response (200 OK):
```json
{
  "id": 1,
  "incident_id": "inc-4a7b2c9d1e3f",
  "title": "Suspicious Activity Cluster on Principal arn:aws:iam::112233445566:user/compromised-contractor",
  "summary": "Correlated incident involving 2 alerts across 2 distinct detection rules.",
  "severity": "CRITICAL",
  "risk_score": 100,
  "status": "INVESTIGATING",
  "correlation_fingerprint": "INC:actor:112233445566:arn:aws:iam::112233445566:user/compromised-contractor",
  "related_alert_ids": ["alt-123", "alt-456"],
  "related_event_ids": ["evt-101", "evt-102"],
  "correlation_reasons": ["Linked by shared actor principal: user/compromised-contractor"],
  "first_seen": "2026-10-09T16:10:00+00:00",
  "last_seen": "2026-10-09T16:15:00+00:00",
  "assigned_analyst": "alice@cloudsentinel.io",
  "resolution_reason": null,
  "created_at": "2026-10-09T16:20:00+00:00",
  "updated_at": "2026-10-09T16:25:00+00:00",
  "audits": [
    {
      "id": 1,
      "incident_id": "inc-4a7b2c9d1e3f",
      "action": "CREATED",
      "previous_state": null,
      "new_state": {"status": "OPEN", "severity": "CRITICAL"},
      "actor": "correlation_engine",
      "reason": "Created incident from 2 correlated alert(s)",
      "created_at": "2026-10-09T16:20:00+00:00"
    },
    {
      "id": 2,
      "incident_id": "inc-4a7b2c9d1e3f",
      "action": "STATUS_CHANGED",
      "previous_state": {"status": "OPEN"},
      "new_state": {"status": "INVESTIGATING"},
      "actor": "alice@cloudsentinel.io",
      "reason": "Initiated triaging",
      "created_at": "2026-10-09T16:25:00+00:00"
    }
  ]
}
```

---

### `GET /api/v1/incidents/{incident_id}/alerts`
Retrieves all underlying `SecurityAlert` objects correlated to an incident.

- **Response (200 OK)**: Array of `AlertResponse` objects.

---

### `PATCH /api/v1/incidents/{incident_id}`
Updates incident status, assignment, or resolution details.
Enforces the mandatory resolution policy: transitioning to `RESOLVED` or `FALSE_POSITIVE` **requires** a non-empty `resolution_reason`.

- **Request Body**:
```json
{
  "status": "RESOLVED",
  "resolution_reason": "Revoked unauthorized AdministratorAccess and rotated credentials.",
  "change_reason": "Remediation verified by SecOps"
}
```

---

## 6. Command Line Usage Examples

### PowerShell
```powershell
# 1. Trigger correlation run
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/incidents/correlate" -Method Post -ContentType "application/json" -Body '{"lookback_minutes": 120}'

# 2. Query open incidents
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/incidents?status=OPEN"

# 3. Assign and investigate an incident
$body = @{ status = "INVESTIGATING"; assigned_analyst = "analyst@company.com" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/incidents/<incident_id>" -Method Patch -ContentType "application/json" -Body $body

# 4. Resolve an incident (resolution_reason required)
$resolveBody = @{ status = "RESOLVED"; resolution_reason = "Revoked malicious access keys" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/incidents/<incident_id>" -Method Patch -ContentType "application/json" -Body $resolveBody
```
