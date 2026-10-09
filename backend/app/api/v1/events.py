from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.event import EventCreate, EventListResponse, EventResponse
from app.services.event_service import (
    EventAlreadyExistsError,
    create_event,
    get_event_by_event_id,
    list_events,
)

router = APIRouter(prefix="/events", tags=["Security Events"])


@router.post(
    "",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest a security event",
    description="Validates and persists a normalized security event into the store. Duplicate event IDs return HTTP 409.",
)
async def ingest_event(
    event_in: EventCreate,
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    try:
        created = await create_event(db=db, event_in=event_in)
        return EventResponse.model_validate(created)
    except EventAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.get(
    "",
    response_model=EventListResponse,
    status_code=status.HTTP_200_OK,
    summary="List security events",
    description="Returns a paginated list of security events ordered by newest ingestion time, with optional filters.",
)
async def get_events(
    limit: int = Query(20, ge=1, le=100, description="Page limit (1-100)"),
    offset: int = Query(0, ge=0, description="Page offset (0 or greater)"),
    event_type: Optional[str] = Query(None, description="Filter by event category"),
    source: Optional[str] = Query(None, description="Filter by event source"),
    outcome: Optional[str] = Query(None, description="Filter by event outcome"),
    db: AsyncSession = Depends(get_db),
) -> EventListResponse:
    items, total = await list_events(
        db=db,
        limit=limit,
        offset=offset,
        event_type=event_type,
        source=source,
        outcome=outcome,
    )
    return EventListResponse(
        items=[EventResponse.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{event_id}",
    response_model=EventResponse,
    status_code=status.HTTP_200_OK,
    summary="Get security event by ID",
    description="Fetches a single security event by its unique event ID. Returns 404 if not found.",
)
async def get_event(
    event_id: str,
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    event = await get_event_by_event_id(db=db, event_id=event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Security event with ID '{event_id}' was not found.",
        )
    return EventResponse.model_validate(event)
