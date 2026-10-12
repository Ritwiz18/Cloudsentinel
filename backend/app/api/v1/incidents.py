from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.correlation.service import (
    IncidentNotFoundError,
    InvalidTransitionError,
    get_incident_alerts,
    get_incident_detail,
    list_incidents,
    run_correlation,
    update_incident,
)
from app.schemas.alert import AlertResponse
from app.schemas.incident import (
    CorrelationRunRequest,
    CorrelationRunResponse,
    IncidentAuditResponse,
    IncidentDetailResponse,
    IncidentListResponse,
    IncidentResponse,
    IncidentUpdateRequest,
)

router = APIRouter(prefix="/incidents", tags=["Security Incidents"])


@router.post(
    "/correlate",
    response_model=CorrelationRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute alert correlation run",
    description="Groups related alerts into incident clusters, updates active incidents, and generates audit entries.",
)
async def trigger_correlation_run(
    request: Optional[CorrelationRunRequest] = None,
    db: AsyncSession = Depends(get_db),
) -> CorrelationRunResponse:
    return await run_correlation(db=db, request=request)


@router.get(
    "",
    response_model=IncidentListResponse,
    status_code=status.HTTP_200_OK,
    summary="List security incidents",
    description="Returns a paginated list of security incidents with optional status, severity, and analyst filters.",
)
async def get_incidents(
    limit: int = Query(20, ge=1, le=100, description="Page limit (1-100)"),
    offset: int = Query(0, ge=0, description="Page offset (0 or greater)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (OPEN, INVESTIGATING, RESOLVED, FALSE_POSITIVE)"),
    severity: Optional[str] = Query(None, description="Filter by severity (INFORMATIONAL, LOW, MEDIUM, HIGH, CRITICAL)"),
    assigned_analyst: Optional[str] = Query(None, description="Filter by assigned analyst"),
    db: AsyncSession = Depends(get_db),
) -> IncidentListResponse:
    items, total = await list_incidents(
        db=db,
        limit=limit,
        offset=offset,
        status=status_filter,
        severity=severity,
        assigned_analyst=assigned_analyst,
    )
    return IncidentListResponse(
        items=[IncidentResponse.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{incident_id}",
    response_model=IncidentDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get incident details and audit trail",
    description="Fetches a single incident along with its chronological audit history.",
)
async def get_incident(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
) -> IncidentDetailResponse:
    try:
        inc, audits = await get_incident_detail(db=db, incident_id=incident_id)
        resp = IncidentDetailResponse.model_validate(inc)
        resp.audits = [IncidentAuditResponse.model_validate(a) for a in audits]
        return resp
    except IncidentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get(
    "/{incident_id}/alerts",
    response_model=List[AlertResponse],
    status_code=status.HTTP_200_OK,
    summary="Get alerts linked to an incident",
    description="Returns all underlying SecurityAlert objects correlated with this incident.",
)
async def get_alerts_for_incident(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
) -> List[AlertResponse]:
    try:
        alerts = await get_incident_alerts(db=db, incident_id=incident_id)
        return [AlertResponse.model_validate(a) for a in alerts]
    except IncidentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.patch(
    "/{incident_id}",
    response_model=IncidentDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Update incident lifecycle and assignment",
    description="Updates status, assignment, or resolution reason with transition validation and audit logging.",
)
async def patch_incident(
    incident_id: str,
    update: IncidentUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> IncidentDetailResponse:
    try:
        inc, audits = await update_incident(db=db, incident_id=incident_id, update=update)
        resp = IncidentDetailResponse.model_validate(inc)
        resp.audits = [IncidentAuditResponse.model_validate(a) for a in audits]
        return resp
    except IncidentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except InvalidTransitionError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
