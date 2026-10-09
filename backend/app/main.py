from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import FastAPI

from app.api.v1.alerts import router as alerts_router
from app.api.v1.detections import router as detections_router
from app.api.v1.events import router as events_router
from app.api.v1.incidents import router as incidents_router
from app.db.session import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables if not already present
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Dispose connection pool cleanly on shutdown
    await engine.dispose()


app = FastAPI(
    title="CloudSentinel API",
    description="AI-powered cloud security, threat detection, and incident response platform",
    version="0.1.0",
    lifespan=lifespan,
)

# Register API v1 routes
app.include_router(events_router, prefix="/api/v1")
app.include_router(detections_router, prefix="/api/v1")
app.include_router(alerts_router, prefix="/api/v1")
app.include_router(incidents_router, prefix="/api/v1")


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
