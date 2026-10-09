from datetime import datetime
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check_returns_200():
    response = client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "cloudsentinel-api"
    assert data["version"] == "0.1.0"
    assert "timestamp" in data

    # Verify timestamp is valid ISO-8601 UTC timestamp
    parsed_time = datetime.fromisoformat(data["timestamp"])
    assert parsed_time.tzinfo is not None
