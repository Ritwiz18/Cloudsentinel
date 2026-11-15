import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .api.v1.alerts import router as alerts_router
from .api.v1.detections import router as detections_router
from .api.v1.events import router as events_router
from .api.v1.incidents import router as incidents_router
from .api.v1.integrations_aws import router as aws_router
from .api.v1.investigations import router as investigations_router
from .api.v1.dashboard import router as dashboard_router
from .api.v1.audit import router as audit_router
from .db.session import Base, engine
from .detection.engine import DetectionEngine
from .investigation.providers.factory import get_investigation_provider

logger = logging.getLogger("cloudsentinel.app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables if not already present.
    #
    # Degrade gracefully if the database is temporarily unreachable: log the
    # failure and keep the process alive so the API (and /health) remain
    # reachable instead of uvicorn refusing to start. Data endpoints will
    # surface an error until the database recovers.
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:  # noqa: BLE001 - startup must not hard-fail
        logger.warning(
            "Database unavailable at startup; starting API in degraded mode: %s",
            exc,
        )
    yield
    # Dispose connection pool cleanly on shutdown
    await engine.dispose()


app = FastAPI(
    title="CloudSentinel API",
    description="AI-powered cloud security, threat detection, and incident response platform",
    version="0.1.0",
    lifespan=lifespan,
)

# Enable CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://[::1]:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://[::1]:3000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API v1 routes
app.include_router(events_router, prefix="/api/v1")
app.include_router(detections_router, prefix="/api/v1")
app.include_router(alerts_router, prefix="/api/v1")
app.include_router(incidents_router, prefix="/api/v1")
app.include_router(aws_router, prefix="/api/v1")
app.include_router(investigations_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for unexpected errors (e.g. database down) so the frontend
    receives a structured JSON body it can render as a useful error message
    instead of a bare 500 with an empty body."""
    logger.error("Unhandled error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error": type(exc).__name__,
            "message": str(exc) or "An unexpected error occurred",
            "path": request.url.path,
        },
    )


@app.get("/health", summary="Health check endpoint", tags=["System"])
async def health_check() -> Dict[str, Any]:
    """
    Liveness + database connectivity probe.

    Always returns HTTP 200 while the process is up so the frontend can
    distinguish "API unreachable" from "API up but database degraded".
    The database check is best-effort with a short timeout and never raises.
    """
    database_status = "connected"
    try:
        async with asyncio.timeout(2.0):
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - probe must never 500
        database_status = "unavailable"
        logger.warning("Health check: database probe failed: %s", exc)

    # Best-effort engine introspection so the frontend can display the real
    # registered rules and investigation provider instead of hardcoded claims.
    engines = {"detection": {"provider": "deterministic-rule-engine", "rules": []}, "investigation": {}}
    try:
        engines["detection"]["rules"] = [r.rule_id for r in DetectionEngine().rules]
        provider = get_investigation_provider()
        engines["investigation"] = {
            "provider": provider.provider_name,
            "model": provider.model_name,
        }
    except Exception as exc:  # noqa: BLE001 - health must never 500
        logger.warning("Health check: engine introspection failed: %s", exc)

    return {
        "status": "healthy",
        "database": database_status,
        "service": "cloudsentinel-api",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "0.1.0",
        "engines": engines,
    }
