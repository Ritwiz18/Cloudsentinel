"""
Audit log API — exposes the incident audit trail for the SOC dashboard.
"""
import csv
import io
import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_db
from ...models.incident import IncidentAudit

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


def _audit_conditions(
    incident_id: Optional[str],
    action: Optional[str],
    actor: Optional[str],
    created_from: Optional[datetime],
    created_to: Optional[datetime],
) -> list:
    conditions = []
    if incident_id:
        conditions.append(IncidentAudit.incident_id == incident_id)
    if action:
        conditions.append(IncidentAudit.action == action.upper())
    if actor:
        conditions.append(IncidentAudit.actor.ilike(f"%{actor}%"))
    if created_from:
        conditions.append(IncidentAudit.created_at >= created_from)
    if created_to:
        conditions.append(IncidentAudit.created_at <= created_to)
    return conditions


async def _fetch_audit_rows(
    db: AsyncSession,
    incident_id: Optional[str],
    action: Optional[str],
    actor: Optional[str],
    created_from: Optional[datetime],
    created_to: Optional[datetime],
) -> List[IncidentAudit]:
    conditions = _audit_conditions(incident_id, action, actor, created_from, created_to)
    stmt = (
        select(IncidentAudit)
        .order_by(IncidentAudit.created_at.desc(), IncidentAudit.id.desc())
        .limit(10000)
    )
    if conditions:
        stmt = stmt.where(and_(*conditions))
    res = await db.execute(stmt)
    return list(res.scalars().all())


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
    actor: Optional[str] = Query(None, description="Filter by analyst actor (case-insensitive substring)"),
    created_from: Optional[datetime] = Query(None, description="Include entries at or after this ISO-8601 timestamp"),
    created_to: Optional[datetime] = Query(None, description="Include entries at or before this ISO-8601 timestamp"),
    db: AsyncSession = Depends(get_db),
) -> AuditLogListResponse:
    conditions = _audit_conditions(incident_id, action, actor, created_from, created_to)

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


def _serialize_audit_rows(rows: List[IncidentAudit]) -> List[dict]:
    return [
        {
            "id": a.id,
            "incident_id": a.incident_id,
            "action": a.action,
            "previous_state": a.previous_state,
            "new_state": a.new_state,
            "actor": a.actor,
            "reason": a.reason,
            "created_at": a.created_at.isoformat(),
        }
        for a in rows
    ]


@router.get(
    "/export",
    status_code=status.HTTP_200_OK,
    summary="Export audit log records as CSV",
    description="Returns all audit log entries matching the same filters as /logs as a downloadable CSV file.",
)
async def export_audit_logs(
    incident_id: Optional[str] = Query(None, description="Filter by incident ID"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    actor: Optional[str] = Query(None, description="Filter by analyst actor (case-insensitive substring)"),
    created_from: Optional[datetime] = Query(None, description="Include entries at or after this ISO-8601 timestamp"),
    created_to: Optional[datetime] = Query(None, description="Include entries at or before this ISO-8601 timestamp"),
    db: AsyncSession = Depends(get_db),
) -> Response:
    rows = await _fetch_audit_rows(db, incident_id, action, actor, created_from, created_to)
    records = _serialize_audit_rows(rows)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["id", "incident_id", "action", "actor", "reason", "previous_state", "new_state", "created_at"])
    for rec in records:
        writer.writerow([
            rec["id"],
            rec["incident_id"],
            rec["action"],
            rec["actor"] or "",
            rec["reason"] or "",
            rec["previous_state"] if isinstance(rec["previous_state"], str) else (
                json.dumps(rec["previous_state"], default=str) if rec["previous_state"] else ""
            ),
            rec["new_state"] if isinstance(rec["new_state"], str) else (
                json.dumps(rec["new_state"], default=str) if rec["new_state"] else ""
            ),
            rec["created_at"],
        ])

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="cloudsentinel_audit_log.csv"',
            "X-Record-Count": str(len(records)),
        },
    )
