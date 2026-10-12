import uuid
from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import SecurityAlert
from app.correlation.engine import CorrelationEngine
from app.correlation.risk_aggregator import calculate_incident_metrics


def create_mock_alert(
    alert_id: str,
    rule_id: str,
    rule_name: str,
    severity: str,
    risk_score: int,
    first_seen: datetime,
    actor: str = "arn:aws:iam::112233445566:user/contractor",
    source_ip: str = "198.51.100.88",
    account_id: str = "112233445566",
    target_resource: str = "arn:aws:s3:::vault-pii",
    status: str = "OPEN",
) -> SecurityAlert:
    return SecurityAlert(
        id=1,
        alert_id=alert_id,
        fingerprint=f"FINGERPRINT-{alert_id}",
        rule_id=rule_id,
        rule_name=rule_name,
        severity=severity,
        risk_score=risk_score,
        confidence=0.9,
        title=f"Alert: {rule_name}",
        description=f"Observed {rule_name}",
        status=status,
        related_event_ids=[f"evt-{uuid.uuid4().hex[:6]}"],
        evidence={
            "actor": actor,
            "source_ip": source_ip,
            "account_id": account_id,
            "target_resource": target_resource,
        },
        first_seen=first_seen,
        last_seen=first_seen + timedelta(minutes=2),
        occurrence_count=1,
        created_at=first_seen,
        updated_at=first_seen,
    )


# -------------------------------------------------------------
# Unit Tests for Correlation Engine & Metrics
# -------------------------------------------------------------

def test_correlation_groups_shared_actor():
    engine = CorrelationEngine(window_minutes=60)
    now = datetime.now(timezone.utc)
    a1 = create_mock_alert("alt-1", "AUTH-001", "Auth Failures", "MEDIUM", 50, now, actor="user/alice")
    a2 = create_mock_alert("alt-2", "IAM-001", "IAM Privilege Grant", "HIGH", 85, now + timedelta(minutes=15), actor="user/alice")

    clusters = engine.correlate_alerts([a1, a2])
    assert len(clusters) == 1
    c = clusters[0]
    assert len(c.alerts) == 2
    assert "user/alice" in c.title
    assert c.primary_pivot_value == "user/alice"


def test_correlation_separates_unrelated_alerts():
    engine = CorrelationEngine(window_minutes=60)
    now = datetime.now(timezone.utc)
    a1 = create_mock_alert("alt-1", "AUTH-001", "Auth Failures", "MEDIUM", 50, now, actor="user/alice", source_ip="1.1.1.1")
    a2 = create_mock_alert("alt-2", "STORAGE-001", "Storage Change", "HIGH", 75, now, actor="user/bob", source_ip="2.2.2.2", target_resource="other-bucket")

    clusters = engine.correlate_alerts([a1, a2])
    assert len(clusters) == 2


def test_correlation_window_boundaries():
    engine = CorrelationEngine(window_minutes=60)
    now = datetime.now(timezone.utc)
    a1 = create_mock_alert("alt-1", "AUTH-001", "Auth Failures", "MEDIUM", 50, now, actor="user/alice")
    # Alert 2 hours later outside 60-min window
    a2 = create_mock_alert("alt-2", "IAM-001", "IAM Change", "HIGH", 80, now + timedelta(hours=2), actor="user/alice")

    clusters = engine.correlate_alerts([a1, a2])
    assert len(clusters) == 2


def test_missing_and_malformed_metadata_handled_safely():
    engine = CorrelationEngine(window_minutes=60)
    now = datetime.now(timezone.utc)
    # Alert with None metadata
    alert = create_mock_alert("alt-empty", "TEST-001", "Empty Test", "LOW", 30, now, actor=None, source_ip=None, account_id=None, target_resource=None)
    alert.evidence = {}

    clusters = engine.correlate_alerts([alert])
    assert len(clusters) == 1
    assert "alt-empty" in clusters[0].fingerprint


def test_risk_metrics_aggregation_highest_severity_wins():
    now = datetime.now(timezone.utc)
    a1 = create_mock_alert("alt-1", "AUTH-001", "Auth Failures", "MEDIUM", 50, now)
    a2 = create_mock_alert("alt-2", "IAM-001", "IAM Change", "CRITICAL", 95, now)

    sev, score = calculate_incident_metrics([a1, a2])
    assert sev == "CRITICAL"
    assert score >= 95


def test_severity_never_decreases():
    now = datetime.now(timezone.utc)
    a1 = create_mock_alert("alt-1", "AUTH-001", "Auth Failures", "LOW", 30, now)
    # Even if only LOW alerts are passed, existing CRITICAL severity is preserved
    sev, score = calculate_incident_metrics([a1], existing_severity="CRITICAL")
    assert sev == "CRITICAL"


# -------------------------------------------------------------
# Integration Tests with API Endpoints & Database
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_incident_correlation_pipeline_and_deduplication(async_client: AsyncClient, db_session: AsyncSession):
    now = datetime.now(timezone.utc)
    actor_arn = "arn:aws:iam::112233445566:user/compromised-admin"

    # 1. Ingest underlying events for two distinct attacks by same actor
    auth_event = {
        "event_id": f"evt-corr-auth-{uuid.uuid4().hex[:6]}",
        "source": "simulator",
        "event_type": "Authentication",
        "timestamp": now.isoformat(),
        "account_id": "112233445566",
        "actor": actor_arn,
        "source_ip": "198.51.100.99",
        "outcome": "FAILURE",
        "metadata": {"attempt": 1},
    }
    # Ingest 5 failures to cross detection threshold
    for i in range(5):
        auth_event["event_id"] = f"evt-corr-auth-{i}-{uuid.uuid4().hex[:6]}"
        auth_event["timestamp"] = (now + timedelta(seconds=i * 5)).isoformat()
        await async_client.post("/api/v1/events", json=auth_event)

    iam_event = {
        "event_id": f"evt-corr-iam-{uuid.uuid4().hex[:6]}",
        "source": "simulator",
        "event_type": "IAMPolicyChange",
        "timestamp": (now + timedelta(minutes=10)).isoformat(),
        "account_id": "112233445566",
        "actor": actor_arn,
        "source_ip": "198.51.100.99",
        "resource": "arn:aws:iam::112233445566:policy/AdministratorAccess",
        "outcome": "SUCCESS",
        "metadata": {
            "api_action": "AttachUserPolicy",
            "policy_arn": "arn:aws:iam::aws:policy/AdministratorAccess",
            "target_user": "compromised-admin",
        },
    }
    await async_client.post("/api/v1/events", json=iam_event)

    # 2. Run detections to generate security alerts
    det_res = await async_client.post("/api/v1/detections/run", json={"lookback_minutes": 120})
    assert det_res.status_code == 200
    assert det_res.json()["alerts_created"] >= 2

    # 3. Run correlation to group the alerts into an incident
    corr_res = await async_client.post("/api/v1/incidents/correlate", json={"lookback_minutes": 120, "window_minutes": 60})
    assert corr_res.status_code == 200
    corr_data = corr_res.json()
    assert corr_data["incidents_created"] >= 1
    assert corr_data["incidents_updated"] == 0

    # 4. Rerun correlation on exact same alerts (Idempotency / Deduplication check)
    corr_rerun = await async_client.post("/api/v1/incidents/correlate", json={"lookback_minutes": 120, "window_minutes": 60})
    assert corr_rerun.status_code == 200
    assert corr_rerun.json()["incidents_created"] == 0

    # 5. List incidents and verify properties
    incidents_res = await async_client.get("/api/v1/incidents?status=OPEN")
    assert incidents_res.status_code == 200
    incidents_data = incidents_res.json()
    assert incidents_data["total"] >= 1
    inc = incidents_data["items"][0]
    assert len(inc["related_alert_ids"]) >= 2
    assert inc["severity"] in ("HIGH", "CRITICAL")
    assert inc["status"] == "OPEN"

    # 6. Fetch incident detail with audit trail
    detail_res = await async_client.get(f"/api/v1/incidents/{inc['incident_id']}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert len(detail["audits"]) >= 1
    assert detail["audits"][0]["action"] == "CREATED"

    # 7. Fetch underlying alerts linked to the incident
    linked_alerts_res = await async_client.get(f"/api/v1/incidents/{inc['incident_id']}/alerts")
    assert linked_alerts_res.status_code == 200
    linked_alerts = linked_alerts_res.json()
    assert len(linked_alerts) >= 2
    assert any(a["rule_id"] == "AUTH-001" for a in linked_alerts)
    assert any(a["rule_id"] == "IAM-001" for a in linked_alerts)


@pytest.mark.asyncio
async def test_incident_lifecycle_transitions_and_resolution_policy(async_client: AsyncClient):
    now = datetime.now(timezone.utc)
    # Ingest event & alert
    payload = {
        "event_id": f"syn-life-{uuid.uuid4().hex[:6]}",
        "source": "simulator",
        "event_type": "IAMPolicyChange",
        "timestamp": now.isoformat(),
        "account_id": "112233445566",
        "actor": "user/lifecycle-tester",
        "outcome": "SUCCESS",
        "metadata": {
            "api_action": "AttachUserPolicy",
            "policy_arn": "arn:aws:iam::aws:policy/AdministratorAccess",
        },
    }
    await async_client.post("/api/v1/events", json=payload)
    await async_client.post("/api/v1/detections/run")
    await async_client.post("/api/v1/incidents/correlate")

    inc_list = (await async_client.get("/api/v1/incidents")).json()
    inc_id = inc_list["items"][0]["incident_id"]

    # 1. Update assignment and move to INVESTIGATING
    patch1 = await async_client.patch(
        f"/api/v1/incidents/{inc_id}",
        json={"status": "INVESTIGATING", "assigned_analyst": "sec-analyst@cloudsentinel.io"},
    )
    assert patch1.status_code == 200
    assert patch1.json()["status"] == "INVESTIGATING"
    assert patch1.json()["assigned_analyst"] == "sec-analyst@cloudsentinel.io"

    # 2. Try resolving WITHOUT resolution_reason -> MUST FAIL (422)
    invalid_resolve = await async_client.patch(
        f"/api/v1/incidents/{inc_id}",
        json={"status": "RESOLVED"},
    )
    assert invalid_resolve.status_code == 422
    assert "resolution_reason is required" in invalid_resolve.json()["detail"].lower()

    # 3. Resolve WITH required resolution reason
    valid_resolve = await async_client.patch(
        f"/api/v1/incidents/{inc_id}",
        json={
            "status": "RESOLVED",
            "resolution_reason": "Revoked unauthorized AdministratorAccess and rotated compromised credentials.",
        },
    )
    assert valid_resolve.status_code == 200
    res_data = valid_resolve.json()
    assert res_data["status"] == "RESOLVED"
    assert "Revoked" in res_data["resolution_reason"]

    # 4. Verify audit trail recorded both changes
    audits = res_data["audits"]
    actions = [a["action"] for a in audits]
    assert "CREATED" in actions
    assert "STATUS_CHANGED" in actions
    assert "ASSIGNED" in actions


@pytest.mark.asyncio
async def test_incident_query_filters_and_404(async_client: AsyncClient):
    # Missing incident 404
    missing_res = await async_client.get("/api/v1/incidents/inc-non-existent-uuid")
    assert missing_res.status_code == 404

    missing_alerts_res = await async_client.get("/api/v1/incidents/inc-non-existent-uuid/alerts")
    assert missing_alerts_res.status_code == 404

    # Pagination validation
    invalid_p = await async_client.get("/api/v1/incidents?limit=0")
    assert invalid_p.status_code == 422


@pytest.mark.asyncio
async def test_attaching_new_alert_updates_existing_open_incident(async_client: AsyncClient):
    now = datetime.now(timezone.utc)
    actor = "arn:aws:iam::112233445566:user/incremental-attacker"

    # Step 1: Ingest 1st attack event
    await async_client.post("/api/v1/events", json={
        "event_id": f"syn-inc-1-{uuid.uuid4().hex[:6]}",
        "source": "simulator",
        "event_type": "StorageConfiguration",
        "timestamp": now.isoformat(),
        "account_id": "112233445566",
        "actor": actor,
        "resource": "arn:aws:s3:::bucket-a",
        "outcome": "SUCCESS",
        "metadata": {"api_action": "DeletePublicAccessBlock", "new_state": "BlocksDisabled"},
    })
    await async_client.post("/api/v1/detections/run")
    res1 = await async_client.post("/api/v1/incidents/correlate")
    assert res1.json()["incidents_created"] >= 1

    # Step 2: Later, same actor conducts 2nd attack event
    await async_client.post("/api/v1/events", json={
        "event_id": f"syn-inc-2-{uuid.uuid4().hex[:6]}",
        "source": "simulator",
        "event_type": "IAMPolicyChange",
        "timestamp": (now + timedelta(minutes=5)).isoformat(),
        "account_id": "112233445566",
        "actor": actor,
        "resource": "arn:aws:iam::112233445566:policy/AdministratorAccess",
        "outcome": "SUCCESS",
        "metadata": {"api_action": "AttachUserPolicy", "policy_arn": "arn:aws:iam::aws:policy/AdministratorAccess"},
    })
    await async_client.post("/api/v1/detections/run")

    # Step 3: Run correlation again -> MUST update the existing open incident!
    res2 = await async_client.post("/api/v1/incidents/correlate")
    assert res2.json()["incidents_updated"] >= 1
    assert res2.json()["incidents_created"] == 0


@pytest.mark.asyncio
async def test_database_error_handling_during_correlation(async_client: AsyncClient):
    from unittest.mock import patch

    with patch("app.api.v1.incidents.run_correlation", side_effect=RuntimeError("Simulated DB error")):
        with pytest.raises(RuntimeError, match="Simulated DB error"):
            await async_client.post("/api/v1/incidents/correlate")

