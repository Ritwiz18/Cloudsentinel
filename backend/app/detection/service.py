import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.detection.engine import DetectionEngine
from app.models.alert import SecurityAlert
from app.models.event import SecurityEvent
from app.schemas.alert import DetectionRunRequest, DetectionRunResponse


async def run_detections(
    db: AsyncSession,
    request: Optional[DetectionRunRequest] = None,
) -> DetectionRunResponse:
    """
    Executes detection rules across stored events, deduplicates against open alerts,
    and persists generated alerts into PostgreSQL.
    """
    req = request or DetectionRunRequest()
    auth_threshold = req.auth_threshold or 5
    auth_window = req.auth_window_minutes or 15

    # Bound query to prevent full-table scans
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=req.lookback_minutes)
    stmt = (
        select(SecurityEvent)
        .where(SecurityEvent.timestamp >= cutoff)
        .order_by(SecurityEvent.timestamp.asc())
        .limit(req.limit)
    )
    result = await db.execute(stmt)
    events: List[SecurityEvent] = list(result.scalars().all())

    # Optional real-only filter
    if req.real_only:
        events = [
            e for e in events
            if not (e.event_metadata or {}).get("is_synthetic", False) and e.source != "simulator"
        ]

    engine = DetectionEngine(auth_threshold=auth_threshold, auth_window_minutes=auth_window)
    detection_results, errors = engine.evaluate_events(events)

    alerts_created = 0
    alerts_updated = 0

    now = datetime.now(timezone.utc)

    for det in detection_results:
        # Check for an active open alert with matching fingerprint
        alert_stmt = select(SecurityAlert).where(
            SecurityAlert.fingerprint == det.fingerprint,
            SecurityAlert.status == "OPEN",
        )
        alert_result = await db.execute(alert_stmt)
        existing_alert = alert_result.scalars().first()

        if existing_alert:
            # Idempotently update the existing alert in place
            existing_alert.last_seen = max(existing_alert.last_seen, det.last_seen)
            existing_alert.occurrence_count = max(existing_alert.occurrence_count, det.occurrence_count)
            # Merge and deduplicate related event IDs
            combined_ids = set(existing_alert.related_event_ids or []) | set(det.related_event_ids)
            existing_alert.related_event_ids = sorted(list(combined_ids))
            existing_alert.evidence = det.evidence
            existing_alert.updated_at = now
            alerts_updated += 1
        else:
            # Create a new alert
            new_alert = SecurityAlert(
                alert_id=f"alt-{uuid.uuid4().hex[:12]}",
                fingerprint=det.fingerprint,
                rule_id=det.rule_id,
                rule_name=det.rule_name,
                severity=det.severity,
                risk_score=det.risk_score,
                confidence=det.confidence,
                title=det.title,
                description=det.description,
                status="OPEN",
                related_event_ids=det.related_event_ids,
                evidence=det.evidence,
                first_seen=det.first_seen,
                last_seen=det.last_seen,
                occurrence_count=det.occurrence_count,
                created_at=now,
                updated_at=now,
            )
            db.add(new_alert)
            alerts_created += 1

    await db.flush()

    return DetectionRunResponse(
        events_evaluated=len(events),
        alerts_created=alerts_created,
        alerts_updated=alerts_updated,
        rules_evaluated=len(engine.rules),
        errors=errors,
    )


async def get_alert_by_id(db: AsyncSession, alert_id: str) -> Optional[SecurityAlert]:
    """
    Fetches a single alert by its external alert_id.
    """
    stmt = select(SecurityAlert).where(SecurityAlert.alert_id == alert_id)
    res = await db.execute(stmt)
    return res.scalars().first()


async def list_alerts(
    db: AsyncSession,
    limit: int = 20,
    offset: int = 0,
    severity: Optional[str] = None,
    rule_id: Optional[str] = None,
    status: Optional[str] = None,
) -> Tuple[List[SecurityAlert], int]:
    """
    Returns paginated alerts ordered newest first, with optional severity, rule_id, or status filters.
    """
    conditions = []
    if severity:
        conditions.append(SecurityAlert.severity == severity.upper())
    if rule_id:
        conditions.append(SecurityAlert.rule_id == rule_id)
    if status:
        conditions.append(SecurityAlert.status == status.upper())

    count_stmt = select(func.count(SecurityAlert.id))
    if conditions:
        count_stmt = count_stmt.where(and_(*conditions))
    total_res = await db.execute(count_stmt)
    total = total_res.scalar_one()

    data_stmt = (
        select(SecurityAlert)
        .order_by(SecurityAlert.created_at.desc(), SecurityAlert.id.desc())
        .limit(limit)
        .offset(offset)
    )
    if conditions:
        data_stmt = data_stmt.where(and_(*conditions))

    data_res = await db.execute(data_stmt)
    items = list(data_res.scalars().all())

    return items, total
