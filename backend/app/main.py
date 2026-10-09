from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import FastAPI

app = FastAPI(
    title="CloudSentinel API",
    description="AI-powered cloud security, threat detection, and incident response platform",
    version="0.1.0",
)


@app.get("/health", summary="Health check endpoint", tags=["System"])
async def health_check() -> Dict[str, Any]:
    """
    Returns system health status and current UTC timestamp.
    """
    return {
        "status": "healthy",
        "service": "cloudsentinel-api",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "0.1.0",
    }
