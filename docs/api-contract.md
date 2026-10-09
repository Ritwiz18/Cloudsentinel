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

#### Request Example:
```json
{
  "event_id": "syn-auth-fail-a1b2c3d4e5f6",
  "source": "simulator",
  "event_type": "Authentication",
  "timestamp": "2026-10-09T16:05:00Z",
  "account_id": "112233445566",
  "region": "us-east-1",
  "actor": "arn:aws:iam::112233445566:user/analyst-bob",
  "source_ip": "203.0.113.195",
  "resource": "arn:aws:iam::112233445566:root",
  "outcome": "FAILURE",
  "metadata": {
    "is_synthetic": true,
    "scenario": "repeated_failed_authentication",
    "attempt_number": 1,
    "error_code": "AuthFailure.IncorrectPassword"
  }
}
```

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
    "scenario": "repeated_failed_authentication",
    "attempt_number": 1,
    "error_code": "AuthFailure.IncorrectPassword"
  },
  "ingested_at": "2026-10-09T16:05:01.123456+00:00"
}
```

#### Error Responses:
- **409 Conflict** (Duplicate event ID):
```json
{
  "detail": "Security event with ID 'syn-auth-fail-a1b2c3d4e5f6' already exists."
}
```
- **422 Unprocessable Entity** (Validation failure):
```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "event_type"],
      "msg": "Field required"
    }
  ]
}
```

---

### `GET /api/v1/events`
Returns a paginated list of security events ordered by ingestion time (newest first).

- **Query Parameters**:
  - `limit` (integer, optional, default: 20, min: 1, max: 100): Number of events to return.
  - `offset` (integer, optional, default: 0, min: 0): Pagination offset.
  - `event_type` (string, optional): Filter by event classification.
  - `source` (string, optional): Filter by origin source.
  - `outcome` (string, optional): Filter by result status.

---

### `GET /api/v1/events/{event_id}`
Retrieves a single security event by its unique string identifier.

- **Path Parameters**:
  - `event_id` (string, required): Unique event ID.
- **Response (200 OK)**: Single `EventResponse` object.
- **Error (404 Not Found)**: Event ID not found.

---

## 3. Threat Detection Endpoints

Base path: `/api/v1/detections`

### `POST /api/v1/detections/run`
Executes detection rules across stored events within a bounded time window, correlates indicators, deduplicates against open alerts, and persists newly discovered or updated alerts.

- **Request Body (optional JSON)**:
  - `limit` (integer, optional, default: 100, max: 500): Maximum stored events to evaluate in this batch.
  - `lookback_minutes` (integer, optional, default: 60, max: 1440): Temporal lookback boundary in minutes.
  - `real_only` (boolean, optional, default: false): If true, ignores synthetic events.
  - `auth_threshold` (integer, optional, default: 5): Override threshold for repeated authentication failures.
  - `auth_window_minutes` (integer, optional, default: 15): Override sliding window in minutes for auth failures.

#### Request Example:
```json
{
  "limit": 100,
  "lookback_minutes": 60,
  "auth_threshold": 5,
  "auth_window_minutes": 15
}
```

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
  - `limit` (integer, optional, default: 20, min: 1, max: 100): Page limit.
  - `offset` (integer, optional, default: 0, min: 0): Page offset.
  - `severity` (string, optional): Filter by severity (`INFORMATIONAL`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
  - `rule_id` (string, optional): Filter by rule identifier (e.g. `AUTH-001`, `IAM-001`, `STORAGE-001`).
  - `status` (string, optional): Filter by lifecycle state (`OPEN`, `INVESTIGATING`, `RESOLVED`, `FALSE_POSITIVE`).

#### Response (200 OK):
```json
{
  "items": [
    {
      "id": 1,
      "alert_id": "alt-8ef201c37b4a",
      "fingerprint": "AUTH-001:actor:arn:aws:iam::112233445566:user/analyst-bob|ip:203.0.113.195",
      "rule_id": "AUTH-001",
      "rule_name": "Repeated Authentication Failures",
      "severity": "HIGH",
      "risk_score": 85,
      "confidence": 0.9,
      "title": "Repeated Authentication Failures (5 attempts)",
      "description": "Observed 5 failed authentication attempts within a 15-minute detection window.",
      "status": "OPEN",
      "related_event_ids": [
        "syn-auth-fail-83aee710857b",
        "syn-auth-fail-d078b43908fb"
      ],
      "evidence": {
        "failure_count": 5,
        "threshold": 5,
        "window_minutes": 15,
        "actor": "arn:aws:iam::112233445566:user/analyst-bob",
        "source_ip": "203.0.113.195",
        "account_id": "112233445566",
        "scoring_breakdown": {
          "base_score": 45,
          "modifiers": {
            "volume_adjustment": 25,
            "root_target": 15
          },
          "final_score": 85,
          "severity": "HIGH"
        }
      },
      "first_seen": "2026-10-09T16:10:15+00:00",
      "last_seen": "2026-10-09T16:11:03+00:00",
      "occurrence_count": 5,
      "created_at": "2026-10-09T16:12:00+00:00",
      "updated_at": "2026-10-09T16:12:00+00:00"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

### `GET /api/v1/alerts/{alert_id}`
Retrieves a single alert by its external identifier.

- **Path Parameters**:
  - `alert_id` (string, required): External alert ID (e.g. `alt-8ef201c37b4a`).
- **Response (200 OK)**: Single `AlertResponse` object.
- **Error (404 Not Found)**: Alert ID not found.

---

## 5. Command Line Usage Examples

### cURL
```bash
# Ingest an event
curl -X POST http://127.0.0.1:8000/api/v1/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt-curl-test-01",
    "source": "simulator",
    "event_type": "Authentication",
    "timestamp": "2026-10-09T16:00:00Z",
    "actor": "arn:aws:iam::123456789012:user/alice",
    "outcome": "FAILURE",
    "metadata": {"is_synthetic": true}
  }'

# Trigger threat detection run
curl -X POST http://127.0.0.1:8000/api/v1/detections/run \
  -H "Content-Type: application/json" \
  -d '{"lookback_minutes": 120}'

# Query active critical alerts
curl "http://127.0.0.1:8000/api/v1/alerts?severity=CRITICAL&status=OPEN"

# Get alert details by ID
curl "http://127.0.0.1:8000/api/v1/alerts/alt-8ef201c37b4a"
```

### PowerShell
```powershell
# Trigger detection run
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/detections/run" -Method Post -ContentType "application/json" -Body '{"lookback_minutes": 120}'

# Query all high & critical alerts
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/alerts?severity=HIGH"
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/alerts?severity=CRITICAL"

# Query single alert
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/alerts/<alert_id>"
```
