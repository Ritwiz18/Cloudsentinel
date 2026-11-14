"""
Audit log API — exposes the incident audit trail for the SOC dashboard.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.incident import IncidentAudit

router = APIRouter(prefix="/audit", tags=["Audit Logs"])


class AuditLogEntry(BaseModel):
    id: int
    incident_id: str
    action: str
    previous_state: Optional[dict] = None
    new_state: Optional[dict] = None
    actor: Optional[str] = None
    reason: Optional[str] = None
    created_at: str

    model_config = ConfigDict(from_attributes=True)


class AuditLogListResponse(BaseModel):
    items: List[AuditLogEntry]
    total: int
    limit: int
    offset: int


@router.get(
    "/logs",
    response_model=AuditLogListResponse,
    status_code=status.HTTP_200_OK,
    summary="List audit log entries",
    description="Returns paginated incident lifecycle audit log entries ordered newest first.",
)
async def get_audit_logs(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    incident_id: Optional[str] = Query(None, description="Filter by incident ID"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    db: AsyncSession = Depends(get_db),
) -> AuditLogListResponse:
    conditions = []
    if incident_id:
        conditions.append(IncidentAudit.incident_id == incident_id)
    if action:
        conditions.append(IncidentAudit.action == action.upper())

    count_stmt = select(func.count(IncidentAudit.id))
    if conditions:
        count_stmt = count_stmt.where(and_(*conditions))
    total_res = await db.execute(count_stmt)
    total = total_res.scalar_one() or 0

    data_stmt = (
        select(IncidentAudit)
        .order_by(IncidentAudit.created_at.desc(), IncidentAudit.id.desc())
        .limit(limit)
        .offset(offset)
    )
    if conditions:
        data_stmt = data_stmt.where(and_(*conditions))

    data_res = await db.execute(data_stmt)
    items = list(data_res.scalars().all())

    return AuditLogListResponse(
        items=[
            AuditLogEntry(
                id=a.id,
                incident_id=a.incident_id,
                action=a.action,
                previous_state=a.previous_state,
                new_state=a.new_state,
                actor=a.actor,
                reason=a.reason,
                created_at=a.created_at.isoformat(),
            )
            for a in items
        ],
        total=total,
        limit=limit,
        offset=offset,
    )
