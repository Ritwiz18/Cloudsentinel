import uuid
from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient

from app.detection.rules.auth_failures import RepeatedAuthFailuresRule
from app.detection.rules.benign_filter import BenignActivityFilterRule
from app.detection.rules.iam_policy import RiskyIAMPolicyRule
from app.detection.rules.storage_config import RiskyStorageConfigRule
from app.models.event import SecurityEvent


def create_mock_event(
    event_id: str,
    event_type: str,
    outcome: str,
    timestamp: datetime,
    actor: str = "arn:aws:iam::112233445566:user/tester",
    source_ip: str = "198.51.100.5",
    resource: str = "arn:aws:iam::112233445566:root",
    metadata: dict = None,
    source: str = "simulator",
    account_id: str = "112233445566",
) -> SecurityEvent:
    return SecurityEvent(
        id=1,
        event_id=event_id,
        source=source,
        event_type=event_type,
        timestamp=timestamp,
        account_id=account_id,
        region="us-east-1",
        actor=actor,
        source_ip=source_ip,
        resource=resource,
        outcome=outcome,
        event_metadata=metadata or {},
        ingested_at=datetime.now(timezone.utc),
    )


# -------------------------------------------------------------
# Unit Tests for Rules
# -------------------------------------------------------------

def test_auth_rule_triggers_at_threshold():
    rule = RepeatedAuthFailuresRule(threshold=5, window_minutes=15)
    base_time = datetime.now(timezone.utc)
    events = [
        create_mock_event(
            event_id=f"evt-auth-{i}",
            event_type="Authentication",
            outcome="FAILURE",
            timestamp=base_time + timedelta(seconds=i * 20),
        )
        for i in range(5)
    ]
    results = rule.evaluate_batch(events)
    assert len(results) == 1
    res = results[0]
    assert res.matched is True
    assert res.rule_id == "AUTH-001"
    assert res.occurrence_count == 5
    assert len(res.related_event_ids) == 5
    assert res.evidence["failure_count"] == 5


def test_auth_rule_below_threshold_does_not_trigger():
    rule = RepeatedAuthFailuresRule(threshold=5, window_minutes=15)
    base_time = datetime.now(timezone.utc)
    events = [
        create_mock_event(
            event_id=f"evt-auth-{i}",
            event_type="Authentication",
            outcome="FAILURE",
            timestamp=base_time + timedelta(seconds=i * 20),
        )
        for i in range(4)  # 4 is below threshold of 5
    ]
    results = rule.evaluate_batch(events)
    assert len(results) == 0


def test_auth_rule_events_outside_window_do_not_count():
    rule = RepeatedAuthFailuresRule(threshold=5, window_minutes=15)
    now = datetime.now(timezone.utc)
    # 3 failures 2 hours ago
    old_events = [
        create_mock_event(
            event_id=f"evt-old-{i}",
            event_type="Authentication",
            outcome="FAILURE",
            timestamp=now - timedelta(hours=2) + timedelta(seconds=i * 10),
        )
        for i in range(3)
    ]
    # 3 failures now
    new_events = [
        create_mock_event(
            event_id=f"evt-new-{i}",
            event_type="Authentication",
            outcome="FAILURE",
            timestamp=now + timedelta(seconds=i * 10),
        )
        for i in range(3)
    ]
    # Total is 6 events, but neither window has >= 5 events
    results = rule.evaluate_batch(old_events + new_events)
    assert len(results) == 0


def test_iam_policy_rule_detects_admin_access():
    rule = RiskyIAMPolicyRule()
    event = create_mock_event(
        event_id="evt-iam-admin",
        event_type="IAMPolicyChange",
        outcome="SUCCESS",
        timestamp=datetime.now(timezone.utc),
        metadata={
            "api_action": "AttachUserPolicy",
            "policy_arn": "arn:aws:iam::aws:policy/AdministratorAccess",
            "target_user": "analyst-bob",
        },
    )
    result = rule.evaluate_event(event)
    assert result is not None
    assert result.matched is True
    assert result.rule_id == "IAM-001"
    assert result.severity in ("HIGH", "CRITICAL")
    assert result.risk_score >= 70
    assert result.evidence["matched_indicator"] == "AdministrativePolicyAttached"


def test_iam_policy_rule_detects_wildcard_assume_role():
    rule = RiskyIAMPolicyRule()
    event = create_mock_event(
        event_id="evt-iam-wildcard",
        event_type="IAMPolicyChange",
        outcome="SUCCESS",
        timestamp=datetime.now(timezone.utc),
        metadata={
            "api_action": "UpdateAssumeRolePolicy",
            "trusted_entities": ["*"],
        },
    )
    result = rule.evaluate_event(event)
    assert result is not None
    assert result.matched is True
    assert result.severity == "CRITICAL"
    assert result.risk_score >= 90
    assert result.evidence["matched_indicator"] == "UnrestrictedAssumeRoleTrust"


def test_storage_rule_detects_bpa_deletion():
    rule = RiskyStorageConfigRule()
    event = create_mock_event(
        event_id="evt-storage-bpa",
        event_type="StorageConfiguration",
        outcome="SUCCESS",
        timestamp=datetime.now(timezone.utc),
        metadata={
            "api_action": "DeletePublicAccessBlock",
            "bucket_name": "vault-pii",
            "new_state": "BlocksDisabled",
        },
    )
    result = rule.evaluate_event(event)
    assert result is not None
    assert result.matched is True
    assert result.rule_id == "STORAGE-001"
    assert result.severity == "CRITICAL"
    assert result.risk_score >= 90
    assert result.evidence["matched_indicator"] == "PublicAccessBlockRemoved"


def test_storage_rule_detects_public_read_acl():
    rule = RiskyStorageConfigRule()
    event = create_mock_event(
        event_id="evt-storage-acl",
        event_type="StorageAccess",
        outcome="SUCCESS",
        timestamp=datetime.now(timezone.utc),
        metadata={
            "api_action": "PutBucketAcl",
            "acl": "public-read",
            "bucket_name": "public-reports",
        },
    )
    result = rule.evaluate_event(event)
    assert result is not None
    assert result.matched is True
    assert result.rule_id == "STORAGE-001"
    assert result.severity == "HIGH"
    assert result.evidence["matched_indicator"] == "PublicReadAclEnabled"


def test_benign_activity_generates_no_alert():
    rule = BenignActivityFilterRule()
    event = create_mock_event(
        event_id="evt-benign-describe",
        event_type="EC2Read",
        outcome="SUCCESS",
        timestamp=datetime.now(timezone.utc),
        metadata={"api_action": "DescribeInstances"},
    )
    result = rule.evaluate_event(event)
    assert result is None


def test_malformed_and_missing_metadata_handled_safely():
    iam_rule = RiskyIAMPolicyRule()
    storage_rule = RiskyStorageConfigRule()

    # Event with empty metadata dict and missing attributes
    malformed_event = create_mock_event(
        event_id="evt-malformed",
        event_type="IAMPolicyChange",
        outcome="SUCCESS",
        timestamp=datetime.now(timezone.utc),
        metadata={},
    )
    assert iam_rule.evaluate_event(malformed_event) is None
    assert storage_rule.evaluate_event(malformed_event) is None


# -------------------------------------------------------------
# Integration Tests with Database & API Endpoints
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_detection_run_and_alert_deduplication(async_client: AsyncClient):
    now = datetime.now(timezone.utc)

    # 1. Ingest 5 failed authentication events (threshold = 5)
    for i in range(5):
        payload = {
            "event_id": f"syn-test-auth-{uuid.uuid4().hex[:8]}",
            "source": "simulator",
            "event_type": "Authentication",
            "timestamp": (now + timedelta(seconds=i * 10)).isoformat(),
            "actor": "arn:aws:iam::112233445566:user/target-user",
            "source_ip": "198.51.100.99",
            "outcome": "FAILURE",
            "metadata": {"attempt": i + 1},
        }
        res = await async_client.post("/api/v1/events", json=payload)
        assert res.status_code == 201

    # 2. Trigger detection run
    run_res = await async_client.post(
        "/api/v1/detections/run",
        json={"auth_threshold": 5, "auth_window_minutes": 15, "lookback_minutes": 60},
    )
    assert run_res.status_code == 200
    run_data = run_res.json()
    assert run_data["events_evaluated"] >= 5
    assert run_data["alerts_created"] >= 1
    assert run_data["alerts_updated"] == 0

    # 3. Re-run detections on the exact same data (deduplication check)
    rerun_res = await async_client.post(
        "/api/v1/detections/run",
        json={"auth_threshold": 5, "auth_window_minutes": 15, "lookback_minutes": 60},
    )
    assert rerun_res.status_code == 200
    rerun_data = rerun_res.json()
    assert rerun_data["alerts_created"] == 0
    assert rerun_data["alerts_updated"] >= 1  # Updated in place, no duplicate alert created!

    # 4. Verify alerts endpoint returns the deduplicated alert
    alerts_res = await async_client.get("/api/v1/alerts?rule_id=AUTH-001")
    assert alerts_res.status_code == 200
    alerts_data = alerts_res.json()
    assert alerts_data["total"] == 1
    alert = alerts_data["items"][0]
    assert alert["rule_id"] == "AUTH-001"
    assert alert["occurrence_count"] == 5
    assert alert["status"] == "OPEN"

    # 5. Fetch single alert by ID
    single_res = await async_client.get(f"/api/v1/alerts/{alert['alert_id']}")
    assert single_res.status_code == 200
    assert single_res.json()["alert_id"] == alert["alert_id"]


@pytest.mark.asyncio
async def test_alert_query_filtering_and_404(async_client: AsyncClient):
    # Missing alert returns 404
    missing_res = await async_client.get("/api/v1/alerts/alt-non-existent-uuid")
    assert missing_res.status_code == 404
    assert "not found" in missing_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_detection_run_with_iam_and_storage_scenarios(async_client: AsyncClient):
    now = datetime.now(timezone.utc)

    # Ingest risky IAM event
    iam_payload = {
        "event_id": f"syn-iam-{uuid.uuid4().hex[:8]}",
        "source": "simulator",
        "event_type": "IAMPolicyChange",
        "timestamp": now.isoformat(),
        "account_id": "112233445566",
        "actor": "arn:aws:iam::112233445566:user/admin-attacker",
        "resource": "arn:aws:iam::112233445566:policy/AdministratorAccess",
        "outcome": "SUCCESS",
        "metadata": {
            "api_action": "AttachUserPolicy",
            "policy_arn": "arn:aws:iam::aws:policy/AdministratorAccess",
            "target_user": "admin-attacker",
        },
    }
    await async_client.post("/api/v1/events", json=iam_payload)

    # Ingest risky storage event
    storage_payload = {
        "event_id": f"syn-storage-{uuid.uuid4().hex[:8]}",
        "source": "simulator",
        "event_type": "StorageConfiguration",
        "timestamp": now.isoformat(),
        "account_id": "112233445566",
        "actor": "arn:aws:iam::112233445566:user/devops",
        "resource": "arn:aws:s3:::critical-vault",
        "outcome": "SUCCESS",
        "metadata": {
            "api_action": "DeletePublicAccessBlock",
            "bucket_name": "critical-vault",
            "new_state": "BlocksDisabled",
        },
    }
    await async_client.post("/api/v1/events", json=storage_payload)

    # Run detections
    run_res = await async_client.post("/api/v1/detections/run")
    assert run_res.status_code == 200
    data = run_res.json()
    assert data["alerts_created"] >= 2

    # Query alerts by severity
    crit_res = await async_client.get("/api/v1/alerts?severity=CRITICAL")
    assert crit_res.status_code == 200
    crit_data = crit_res.json()
    assert any(a["rule_id"] == "STORAGE-001" for a in crit_data["items"])

    # Query alerts by rule_id
    iam_res = await async_client.get("/api/v1/alerts?rule_id=IAM-001")
    assert iam_res.status_code == 200
    assert iam_res.json()["total"] >= 1
    alert_item = iam_res.json()["items"][0]
    assert "AdministratorAccess" in alert_item["evidence"]["policy_arn"]
    assert alert_item["risk_score"] >= 70


@pytest.mark.asyncio
async def test_detection_engine_error_containment(async_client: AsyncClient):
    from unittest.mock import patch

    # Mock a faulty rule throwing an exception
    with patch("app.detection.rules.iam_policy.RiskyIAMPolicyRule.evaluate_batch", side_effect=ValueError("Fault injection")):
        res = await async_client.post("/api/v1/detections/run")
        assert res.status_code == 200
        data = res.json()
        assert len(data["errors"]) >= 1
        assert "Fault injection" in data["errors"][0]

