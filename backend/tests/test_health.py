from datetime import datetime
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check_returns_200(async_client: AsyncClient):
    """
    Verifies that the /health endpoint continues to function correctly
    and returns healthy status, service identifier, and valid UTC timestamp.
    """
    response = await async_client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "cloudsentinel-api"
    assert data["version"] == "0.1.0"
    assert "timestamp" in data

    # Verify timestamp is valid ISO-8601 UTC timestamp
    parsed_time = datetime.fromisoformat(data["timestamp"])
    assert parsed_time.tzinfo is not None
