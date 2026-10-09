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

#### Response (200 OK):
```json
{
  "items": [
    {
      "id": 2,
      "event_id": "syn-iam-policy-998877",
      "source": "simulator",
      "event_type": "IAMPolicyChange",
      "timestamp": "2026-10-09T16:06:00+00:00",
      "account_id": "112233445566",
      "region": "us-east-1",
      "actor": "arn:aws:iam::112233445566:user/contractor",
      "source_ip": "198.51.100.88",
      "resource": "arn:aws:iam::112233445566:policy/AdministratorAccess",
      "outcome": "SUCCESS",
      "metadata": { "is_synthetic": true },
      "ingested_at": "2026-10-09T16:06:01.000000+00:00"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

### `GET /api/v1/events/{event_id}`
Retrieves a single security event by its unique string identifier.

- **Path Parameters**:
  - `event_id` (string, required): Unique event ID.
- **Response (200 OK)**: Single `EventResponse` object.
- **Error (404 Not Found)**:
```json
{
  "detail": "Security event with ID 'non-existent-id' was not found."
}
```

---

## 3. Command Line Usage Examples

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
    "outcome": "SUCCESS",
    "metadata": {"is_synthetic": true}
  }'

# List events with pagination and filter
curl "http://127.0.0.1:8000/api/v1/events?limit=10&event_type=Authentication"

# Get a single event
curl "http://127.0.0.1:8000/api/v1/events/evt-curl-test-01"
```

### PowerShell
```powershell
# Ingest an event
$body = @{
    event_id   = "evt-ps-test-01"
    source     = "simulator"
    event_type = "IAMPolicyChange"
    timestamp  = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    actor      = "arn:aws:iam::123456789012:user/bob"
    outcome    = "SUCCESS"
    metadata   = @{ is_synthetic = $true }
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/events" -Method Post -ContentType "application/json" -Body $body

# Query events
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/events?limit=5"
```
