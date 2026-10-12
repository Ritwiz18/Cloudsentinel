from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.detection.service import get_alert_by_id, list_alerts
from app.schemas.alert import AlertListResponse, AlertResponse

router = APIRouter(prefix="/alerts", tags=["Security Alerts"])


@router.get(
    "",
    response_model=AlertListResponse,
    status_code=status.HTTP_200_OK,
    summary="List security alerts",
    description="Returns a paginated list of security alerts ordered newest first, with optional filters.",
)
async def get_alerts(
    limit: int = Query(20, ge=1, le=100, description="Page limit (1-100)"),
    offset: int = Query(0, ge=0, description="Page offset (0 or greater)"),
    severity: Optional[str] = Query(None, description="Filter by severity band (INFORMATIONAL, LOW, MEDIUM, HIGH, CRITICAL)"),
    rule_id: Optional[str] = Query(None, description="Filter by detection rule ID (e.g. AUTH-001)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by alert status (OPEN, INVESTIGATING, RESOLVED)"),
    db: AsyncSession = Depends(get_db),
) -> AlertListResponse:
    items, total = await list_alerts(
        db=db,
        limit=limit,
        offset=offset,
        severity=severity,
        rule_id=rule_id,
        status=status_filter,
    )
    return AlertListResponse(
        items=[AlertResponse.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{alert_id}",
    response_model=AlertResponse,
    status_code=status.HTTP_200_OK,
    summary="Get security alert by ID",
    description="Retrieves a single security alert by its external identifier. Returns 404 if not found.",
)
async def get_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
) -> AlertResponse:
    alert = await get_alert_by_id(db=db, alert_id=alert_id)
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Security alert with ID '{alert_id}' was not found.",
        )
    return AlertResponse.model_validate(alert)
