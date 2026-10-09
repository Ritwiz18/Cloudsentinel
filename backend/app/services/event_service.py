from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import SecurityEvent
from app.schemas.event import EventCreate


class EventAlreadyExistsError(Exception):
    """Raised when an event with the given event_id already exists."""
    def __init__(self, event_id: str):
        self.event_id = event_id
        super().__init__(f"Security event with ID '{event_id}' already exists.")


async def create_event(db: AsyncSession, event_in: EventCreate) -> SecurityEvent:
    """
    Ingests and persists a validated security event into PostgreSQL.
    Enforces uniqueness on event_id.
    """
    # Check for existing event to provide deterministic idempotent error handling
    stmt = select(SecurityEvent.id).where(SecurityEvent.event_id == event_in.event_id)
    result = await db.execute(stmt)
    if result.scalar_one_or_none() is not None:
        raise EventAlreadyExistsError(event_in.event_id)

    db_event = SecurityEvent(
        event_id=event_in.event_id,
        source=event_in.source,
        event_type=event_in.event_type,
        timestamp=event_in.timestamp,
        account_id=event_in.account_id,
        region=event_in.region,
        actor=event_in.actor,
        source_ip=event_in.source_ip,
        resource=event_in.resource,
        outcome=event_in.outcome,
        event_metadata=event_in.metadata,
        ingested_at=datetime.now(timezone.utc),
    )
    db.add(db_event)
    await db.flush()
    await db.refresh(db_event)
    return db_event


async def get_event_by_event_id(db: AsyncSession, event_id: str) -> Optional[SecurityEvent]:
    """
    Retrieves a single security event by its public unique event_id.
    """
    stmt = select(SecurityEvent).where(SecurityEvent.event_id == event_id)
    result = await db.execute(stmt)
    return result.scalars().first()


async def list_events(
    db: AsyncSession,
    limit: int = 20,
    offset: int = 0,
    event_type: Optional[str] = None,
    source: Optional[str] = None,
    outcome: Optional[str] = None,
) -> Tuple[List[SecurityEvent], int]:
    """
    Retrieves paginated security events, newest ingestion time first,
    with optional filtering by event_type, source, or outcome.
    """
    conditions = []
    if event_type:
        conditions.append(SecurityEvent.event_type == event_type)
    if source:
        conditions.append(SecurityEvent.source == source)
    if outcome:
        conditions.append(SecurityEvent.outcome == outcome)

    # Calculate total matching count
    count_stmt = select(func.count(SecurityEvent.id))
    if conditions:
        count_stmt = count_stmt.where(and_(*conditions))
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    # Query page items
    data_stmt = (
        select(SecurityEvent)
        .order_by(SecurityEvent.ingested_at.desc(), SecurityEvent.id.desc())
        .limit(limit)
        .offset(offset)
    )
    if conditions:
        data_stmt = data_stmt.where(and_(*conditions))

    data_result = await db.execute(data_stmt)
    items = list(data_result.scalars().all())

    return items, total
