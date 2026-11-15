import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("cloudsentinel.api.investigations")

from ...db.session import get_db
from ...investigation.service import (
    IncidentNotFoundError,
    InvestigationNotFoundError,
    get_investigation_by_id,
    investigate_incident,
    list_investigations,
    list_investigations_for_incident,
)
from ...schemas.investigation import (
    InvestigationCreateRequest,
    InvestigationListResponse,
    InvestigationResponse,
)

router = APIRouter(tags=["AI Investigation"])


@router.post(
    "/incidents/{incident_id}/investigate",
    response_model=InvestigationResponse,
    status_code=status.HTTP_200_OK,
    summary="Run or retrieve AI-assisted incident investigation",
    description="Analyzes incident telemetry, correlated alerts, affected resources, and detection rules to generate structured findings.",
)
async def trigger_incident_investigation(
    incident_id: str,
    request: Optional[InvestigationCreateRequest] = None,
    db: AsyncSession = Depends(get_db),
) -> InvestigationResponse:
    force_refresh = request.force_refresh if request else False
    analyst_notes = request.analyst_notes if request else None

    try:
        inv = await investigate_incident(
            db=db,
            incident_id=incident_id,
            force_refresh=force_refresh,
            analyst_notes=analyst_notes,
        )
        return InvestigationResponse.model_validate(inv)
    except IncidentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.error(
            "Unhandled exception during investigation for incident '%s': %s",
            incident_id, exc, exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Investigation could not be completed. Review server logs for details.",
        ) from exc


@router.get(
    "/incidents/{incident_id}/investigations",
    response_model=InvestigationListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get investigation history for an incident",
    description="Returns all historical investigation reports for the specified security incident.",
)
async def get_incident_investigations(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
) -> InvestigationListResponse:
    try:
        items = await list_investigations_for_incident(db=db, incident_id=incident_id)
        return InvestigationListResponse(
            items=[InvestigationResponse.model_validate(i) for i in items],
            total=len(items),
        )
    except IncidentNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get(
    "/investigations",
    response_model=InvestigationListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all investigation reports",
    description="Returns paginated investigation reports across all incidents, newest first, with an optional incident_id filter.",
)
async def list_all_investigations(
    limit: int = Query(20, ge=1, le=100, description="Page limit (1-100)"),
    offset: int = Query(0, ge=0, description="Page offset (0 or greater)"),
    incident_id: Optional[str] = Query(None, description="Filter by incident ID"),
    db: AsyncSession = Depends(get_db),
) -> InvestigationListResponse:
    items, total = await list_investigations(
        db=db, limit=limit, offset=offset, incident_id=incident_id
    )
    return InvestigationListResponse(
        items=[InvestigationResponse.model_validate(i) for i in items],
        total=total,
    )


@router.get(
    "/investigations/{investigation_id}",
    response_model=InvestigationResponse,
    status_code=status.HTTP_200_OK,
    summary="Get investigation report by ID",
    description="Retrieves a specific investigation report by its unique identifier.",
)
async def get_single_investigation(
    investigation_id: str,
    db: AsyncSession = Depends(get_db),
) -> InvestigationResponse:
    try:
        inv = await get_investigation_by_id(db=db, investigation_id=investigation_id)
        return InvestigationResponse.model_validate(inv)
    except InvestigationNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
