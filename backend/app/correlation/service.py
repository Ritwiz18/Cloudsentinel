import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.correlation.engine import CorrelationEngine
from app.correlation.risk_aggregator import calculate_incident_metrics
from app.models.alert import SecurityAlert
from app.models.incident import Incident, IncidentAudit
from app.schemas.incident import CorrelationRunRequest, CorrelationRunResponse, IncidentUpdateRequest

VALID_STATUSES = {"OPEN", "INVESTIGATING", "RESOLVED", "FALSE_POSITIVE"}


class IncidentNotFoundError(Exception):
    def __init__(self, incident_id: str):
        super().__init__(f"Incident '{incident_id}' was not found.")
        self.incident_id = incident_id


class InvalidTransitionError(Exception):
    pass


async def run_correlation(
    db: AsyncSession,
    request: Optional[CorrelationRunRequest] = None,
) -> CorrelationRunResponse:
    """
    Evaluates alerts within the lookback window, groups related alerts into incident clusters,
    and updates existing open incidents or creates new incidents with audit history.
    """
    req = request or CorrelationRunRequest()
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=req.lookback_minutes)

    # Fetch eligible alerts
    query = select(SecurityAlert).where(SecurityAlert.created_at >= cutoff)
    if req.status_filter:
        query = query.where(SecurityAlert.status == req.status_filter.upper())
    query = query.order_by(SecurityAlert.first_seen.asc()).limit(500)

    alert_result = await db.execute(query)
    alerts: List[SecurityAlert] = list(alert_result.scalars().all())

    engine = CorrelationEngine(window_minutes=req.window_minutes)
    clusters = engine.correlate_alerts(alerts)

    incidents_created = 0
    incidents_updated = 0
    now = datetime.now(timezone.utc)

    for cluster in clusters:
        # Check if an active open incident exists with the same fingerprint
        stmt = select(Incident).where(
            Incident.correlation_fingerprint == cluster.fingerprint,
            Incident.status.in_(["OPEN", "INVESTIGATING"]),
        )
        res = await db.execute(stmt)
        existing_incident = res.scalars().first()

        cluster_alert_ids = [a.alert_id for a in cluster.alerts]
        cluster_event_ids: List[str] = []
        for a in cluster.alerts:
            cluster_event_ids.extend(a.related_event_ids or [])

        first_seen = min(a.first_seen for a in cluster.alerts)
        last_seen = max(a.last_seen for a in cluster.alerts)

        if existing_incident:
            # Check if there are genuinely new alerts to attach
            new_alerts = [a for a in cluster.alerts if a.alert_id not in existing_incident.related_alert_ids]
            if new_alerts:
                merged_alert_ids = sorted(list(set(existing_incident.related_alert_ids + cluster_alert_ids)))
                merged_event_ids = sorted(list(set(existing_incident.related_event_ids + cluster_event_ids)))
                merged_reasons = sorted(list(set(existing_incident.correlation_reasons + cluster.correlation_reasons)))

                # Recalculate metrics across all linked alerts
                all_alerts_stmt = select(SecurityAlert).where(SecurityAlert.alert_id.in_(merged_alert_ids))
                all_alerts_res = await db.execute(all_alerts_stmt)
                all_linked_alerts = list(all_alerts_res.scalars().all())

                new_sev, new_score = calculate_incident_metrics(all_linked_alerts, existing_severity=existing_incident.severity)

                old_state = {
                    "severity": existing_incident.severity,
                    "risk_score": existing_incident.risk_score,
                    "alert_count": len(existing_incident.related_alert_ids),
                }

                existing_incident.related_alert_ids = merged_alert_ids
                existing_incident.related_event_ids = merged_event_ids
                existing_incident.correlation_reasons = merged_reasons
                existing_incident.severity = new_sev
                existing_incident.risk_score = new_score
                existing_incident.last_seen = max(existing_incident.last_seen, last_seen)
                existing_incident.updated_at = now

                # Audit entry for new alerts attached
                audit = IncidentAudit(
                    incident_id=existing_incident.incident_id,
                    action="ALERTS_ATTACHED",
                    previous_state=old_state,
                    new_state={
                        "severity": new_sev,
                        "risk_score": new_score,
                        "alert_count": len(merged_alert_ids),
                        "new_alert_ids": [a.alert_id for a in new_alerts],
                    },
                    actor="correlation_engine",
                    reason=f"Attached {len(new_alerts)} newly correlated alert(s)",
                    created_at=now,
                )
                db.add(audit)
                incidents_updated += 1
            else:
                # Same alerts re-evaluated: idempotent no-op
                pass
        else:
            # Create new Incident
            sev, score = calculate_incident_metrics(cluster.alerts)
            new_inc_id = f"inc-{uuid.uuid4().hex[:12]}"

            incident = Incident(
                incident_id=new_inc_id,
                title=cluster.title,
                summary=cluster.summary,
                severity=sev,
                risk_score=score,
                status="OPEN",
                correlation_fingerprint=cluster.fingerprint,
                related_alert_ids=cluster_alert_ids,
                related_event_ids=sorted(list(set(cluster_event_ids))),
                correlation_reasons=cluster.correlation_reasons,
                first_seen=first_seen,
                last_seen=last_seen,
                created_at=now,
                updated_at=now,
            )
            db.add(incident)

            # Audit entry for incident creation
            audit = IncidentAudit(
                incident_id=new_inc_id,
                action="CREATED",
                new_state={"status": "OPEN", "severity": sev, "risk_score": score},
                actor="correlation_engine",
                reason=f"Created incident from {len(cluster.alerts)} correlated alert(s)",
                created_at=now,
            )
            db.add(audit)
            incidents_created += 1

    await db.flush()

    return CorrelationRunResponse(
        alerts_evaluated=len(alerts),
        incidents_created=incidents_created,
        incidents_updated=incidents_updated,
        errors=[],
    )


async def list_incidents(
    db: AsyncSession,
    limit: int = 20,
    offset: int = 0,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    assigned_analyst: Optional[str] = None,
) -> Tuple[List[Incident], int]:
    """
    Returns paginated incidents ordered newest first, with optional filters.
    """
    conditions = []
    if status:
        conditions.append(Incident.status == status.upper())
    if severity:
        conditions.append(Incident.severity == severity.upper())
    if assigned_analyst:
        conditions.append(Incident.assigned_analyst == assigned_analyst)

    count_stmt = select(func.count(Incident.id))
    if conditions:
        count_stmt = count_stmt.where(and_(*conditions))
    total = (await db.execute(count_stmt)).scalar_one()

    data_stmt = (
        select(Incident)
        .order_by(Incident.created_at.desc(), Incident.id.desc())
        .limit(limit)
        .offset(offset)
    )
    if conditions:
        data_stmt = data_stmt.where(and_(*conditions))

    items = list((await db.execute(data_stmt)).scalars().all())
    return items, total


async def get_incident_detail(
    db: AsyncSession,
    incident_id: str,
) -> Tuple[Incident, List[IncidentAudit]]:
    """
    Fetches an incident and its chronological audit history.
    """
    stmt = select(Incident).where(Incident.incident_id == incident_id)
    inc = (await db.execute(stmt)).scalars().first()
    if not inc:
        raise IncidentNotFoundError(incident_id)

    audit_stmt = (
        select(IncidentAudit)
        .where(IncidentAudit.incident_id == incident_id)
        .order_by(IncidentAudit.created_at.asc(), IncidentAudit.id.asc())
    )
    audits = list((await db.execute(audit_stmt)).scalars().all())
    return inc, audits


async def get_incident_alerts(
    db: AsyncSession,
    incident_id: str,
) -> List[SecurityAlert]:
    """
    Retrieves all SecurityAlert entities correlated to an incident.
    """
    stmt = select(Incident).where(Incident.incident_id == incident_id)
    inc = (await db.execute(stmt)).scalars().first()
    if not inc:
        raise IncidentNotFoundError(incident_id)

    if not inc.related_alert_ids:
        return []

    alerts_stmt = select(SecurityAlert).where(SecurityAlert.alert_id.in_(inc.related_alert_ids))
    return list((await db.execute(alerts_stmt)).scalars().all())


async def update_incident(
    db: AsyncSession,
    incident_id: str,
    update: IncidentUpdateRequest,
) -> Tuple[Incident, List[IncidentAudit]]:
    """
    Applies validated status, assignment, and resolution updates to an incident with audit logging.
    """
    inc, audits = await get_incident_detail(db, incident_id)
    now = datetime.now(timezone.utc)

    # 1. Status transition validation
    if update.status:
        target_status = update.status.upper()
        if target_status not in VALID_STATUSES:
            raise InvalidTransitionError(f"Status '{update.status}' is invalid. Allowed: {', '.join(sorted(VALID_STATUSES))}")

        # Mandatory resolution reason policy
        if target_status in ("RESOLVED", "FALSE_POSITIVE"):
            if not update.resolution_reason or not update.resolution_reason.strip():
                raise InvalidTransitionError(
                    f"A non-empty resolution_reason is required when transitioning to {target_status}."
                )

        if target_status != inc.status:
            old_status = inc.status
            inc.status = target_status
            if update.resolution_reason:
                inc.resolution_reason = update.resolution_reason.strip()

            audit = IncidentAudit(
                incident_id=inc.incident_id,
                action="STATUS_CHANGED",
                previous_state={"status": old_status},
                new_state={"status": target_status, "resolution_reason": inc.resolution_reason},
                actor=update.assigned_analyst or "analyst",
                reason=update.change_reason or update.resolution_reason or f"Transitioned from {old_status} to {target_status}",
                created_at=now,
            )
            db.add(audit)

    # 2. Assignment change
    if update.assigned_analyst is not None and update.assigned_analyst != inc.assigned_analyst:
        old_analyst = inc.assigned_analyst
        inc.assigned_analyst = update.assigned_analyst.strip() if update.assigned_analyst else None

        audit = IncidentAudit(
            incident_id=inc.incident_id,
            action="ASSIGNED",
            previous_state={"assigned_analyst": old_analyst},
            new_state={"assigned_analyst": inc.assigned_analyst},
            actor="analyst",
            reason=update.change_reason or f"Reassigned from {old_analyst} to {inc.assigned_analyst}",
            created_at=now,
        )
        db.add(audit)

    # Update resolution reason if provided separately
    if update.resolution_reason and update.resolution_reason.strip() != inc.resolution_reason:
        inc.resolution_reason = update.resolution_reason.strip()

    inc.updated_at = now
    await db.flush()

    return await get_incident_detail(db, incident_id)
