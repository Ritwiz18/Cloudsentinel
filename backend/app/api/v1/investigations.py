from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.investigation.service import (
    IncidentNotFoundError,
    InvestigationNotFoundError,
    get_investigation_by_id,
    investigate_incident,
    list_investigations_for_incident,
)
from app.schemas.investigation import (
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Investigation failed: {str(exc)}",
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
