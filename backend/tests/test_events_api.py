from datetime import datetime, timezone
import pytest
from httpx import AsyncClient


def sample_event_payload(event_id: str = "evt-test-001", outcome: str = "SUCCESS", event_type: str = "Authentication"):
    return {
        "event_id": event_id,
        "source": "simulator",
        "event_type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "account_id": "123456789012",
        "region": "us-east-1",
        "actor": "arn:aws:iam::123456789012:user/sec-admin",
        "source_ip": "198.51.100.25",
        "resource": "arn:aws:iam::123456789012:role/SecurityAudit",
        "outcome": outcome,
        "metadata": {
            "is_synthetic": True,
            "scenario": "test_suite",
            "mfa_present": True,
        },
    }


@pytest.mark.asyncio
async def test_ingest_valid_event(async_client: AsyncClient):
    payload = sample_event_payload("evt-valid-001")
    response = await async_client.post("/api/v1/events", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["event_id"] == "evt-valid-001"
    assert data["source"] == "simulator"
    assert data["event_type"] == "Authentication"
    assert data["outcome"] == "SUCCESS"
    assert data["metadata"]["is_synthetic"] is True
    assert "id" in data
    assert "ingested_at" in data


@pytest.mark.asyncio
async def test_ingest_duplicate_event_returns_409(async_client: AsyncClient):
    payload = sample_event_payload("evt-duplicate-001")

    # First ingestion succeeds
    res1 = await async_client.post("/api/v1/events", json=payload)
    assert res1.status_code == 201

    # Second ingestion with same event_id must return 409 Conflict
    res2 = await async_client.post("/api/v1/events", json=payload)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]


@pytest.mark.asyncio
async def test_ingest_invalid_payload_returns_422(async_client: AsyncClient):
    # Missing required 'event_type' and 'outcome'
    invalid_payload = {
        "event_id": "evt-invalid-001",
        "source": "simulator",
        "timestamp": "2026-10-09T12:00:00Z",
    }
    response = await async_client.post("/api/v1/events", json=invalid_payload)
    assert response.status_code == 422

    # Blank/whitespace event_id
    blank_id_payload = sample_event_payload(event_id="   ")
    response2 = await async_client.post("/api/v1/events", json=blank_id_payload)
    assert response2.status_code == 422


@pytest.mark.asyncio
async def test_get_event_by_id_success(async_client: AsyncClient):
    payload = sample_event_payload("evt-get-001")
    create_res = await async_client.post("/api/v1/events", json=payload)
    assert create_res.status_code == 201

    get_res = await async_client.get("/api/v1/events/evt-get-001")
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["event_id"] == "evt-get-001"
    assert data["actor"] == "arn:aws:iam::123456789012:user/sec-admin"
    assert data["metadata"]["scenario"] == "test_suite"


@pytest.mark.asyncio
async def test_get_missing_event_returns_404(async_client: AsyncClient):
    response = await async_client.get("/api/v1/events/non-existent-uuid")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_list_events_pagination(async_client: AsyncClient):
    # Ingest 5 events
    for i in range(5):
        payload = sample_event_payload(f"evt-page-{i:03d}")
        res = await async_client.post("/api/v1/events", json=payload)
        assert res.status_code == 201

    # Fetch page with limit=2, offset=0
    p1 = await async_client.get("/api/v1/events?limit=2&offset=0")
    assert p1.status_code == 200
    data1 = p1.json()
    assert len(data1["items"]) == 2
    assert data1["total"] == 5
    assert data1["limit"] == 2
    assert data1["offset"] == 0

    # Fetch page with limit=2, offset=2
    p2 = await async_client.get("/api/v1/events?limit=2&offset=2")
    assert p2.status_code == 200
    data2 = p2.json()
    assert len(data2["items"]) == 2
    assert data2["offset"] == 2

    # Verify pagination boundary validation
    invalid_limit = await async_client.get("/api/v1/events?limit=0")
    assert invalid_limit.status_code == 422

    exceed_limit = await async_client.get("/api/v1/events?limit=101")
    assert exceed_limit.status_code == 422

    negative_offset = await async_client.get("/api/v1/events?offset=-1")
    assert negative_offset.status_code == 422


@pytest.mark.asyncio
async def test_list_events_filtering(async_client: AsyncClient):
    # Ingest distinct events
    await async_client.post("/api/v1/events", json=sample_event_payload("evt-filter-1", outcome="SUCCESS", event_type="IAMPolicyChange"))
    await async_client.post("/api/v1/events", json=sample_event_payload("evt-filter-2", outcome="FAILURE", event_type="Authentication"))
    await async_client.post("/api/v1/events", json=sample_event_payload("evt-filter-3", outcome="FAILURE", event_type="IAMPolicyChange"))

    # Filter by event_type
    res_type = await async_client.get("/api/v1/events?event_type=IAMPolicyChange")
    assert res_type.status_code == 200
    assert res_type.json()["total"] == 2

    # Filter by outcome
    res_outcome = await async_client.get("/api/v1/events?outcome=FAILURE")
    assert res_outcome.status_code == 200
    assert res_outcome.json()["total"] == 2

    # Filter by both event_type and outcome
    res_both = await async_client.get("/api/v1/events?event_type=IAMPolicyChange&outcome=FAILURE")
    assert res_both.status_code == 200
    assert res_both.json()["total"] == 1
    assert res_both.json()["items"][0]["event_id"] == "evt-filter-3"

    # Filter by source
    res_source = await async_client.get("/api/v1/events?source=simulator")
    assert res_source.status_code == 200
    assert res_source.json()["total"] == 3


@pytest.mark.asyncio
async def test_database_error_handling_and_rollback(async_client: AsyncClient, db_session):
    from unittest.mock import patch
    from app.services import event_service

    # Simulate an unexpected operational failure during creation
    with patch("app.api.v1.events.create_event", side_effect=RuntimeError("Simulated DB connection drop")):
        with pytest.raises(RuntimeError, match="Simulated DB connection drop"):
            await async_client.post("/api/v1/events", json=sample_event_payload("evt-fail-trans"))

    # Ensure system remains responsive and subsequent valid transactions succeed
    valid_res = await async_client.post("/api/v1/events", json=sample_event_payload("evt-after-fail"))
    assert valid_res.status_code == 201
