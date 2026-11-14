"""
Dashboard overview API — returns aggregated SOC metrics in a single efficient query bundle.
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.alert import SecurityAlert
from app.models.event import SecurityEvent
from app.models.incident import Incident, IncidentAudit
from app.models.investigation import Investigation

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


class SeverityCount(BaseModel):
    CRITICAL: int = 0
    HIGH: int = 0
    MEDIUM: int = 0
    LOW: int = 0
    INFORMATIONAL: int = 0


class StatusCount(BaseModel):
    OPEN: int = 0
    INVESTIGATING: int = 0
    RESOLVED: int = 0
    FALSE_POSITIVE: int = 0


class RecentEvent(BaseModel):
    event_id: str
    source: str
    event_type: str
    outcome: str
    actor: Optional[str] = None
    region: Optional[str] = None
    timestamp: str
    ingested_at: str


class RecentAlert(BaseModel):
    alert_id: str
    rule_name: str
    severity: str
    risk_score: int
    title: str
    status: str
    first_seen: str
    occurrence_count: int


class RecentIncident(BaseModel):
    incident_id: str
    title: str
    severity: str
    risk_score: int
    status: str
    first_seen: str
    assigned_analyst: Optional[str] = None


class IntegrationStatus(BaseModel):
    name: str
    status: str
    details: str


class DashboardOverview(BaseModel):
    # Counts
    total_events: int = Field(description="Total security events ingested")
    total_alerts: int = Field(description="Total security alerts")
    total_incidents: int = Field(description="Total security incidents")
    total_investigations: int = Field(description="Total AI investigations run")

    # Alert breakdown by severity
    alerts_by_severity: SeverityCount

    # Alert breakdown by status
    alerts_by_status: StatusCount

    # Incident breakdown by status
    incidents_by_status: StatusCount

    # Critical/high combined
    critical_high_alerts: int = Field(description="Alerts with CRITICAL or HIGH severity")
    open_critical_high_alerts: int = Field(description="Open CRITICAL or HIGH alerts")

    # Posture score (0-100, 100 = best)
    security_posture_score: int = Field(description="Calculated security posture score (0-100)")
    posture_grade: str = Field(description="Letter grade: A, B, C, D, F")

    # Recent activity
    recent_events: List[RecentEvent] = Field(default_factory=list)
    recent_alerts: List[RecentAlert] = Field(default_factory=list)
    recent_incidents: List[RecentIncident] = Field(default_factory=list)

    # Events ingested in last 24h
    events_last_24h: int = 0
    alerts_last_24h: int = 0
    incidents_last_24h: int = 0

    # Timestamp
    generated_at: str


def _calculate_posture_score(
    total_critical: int,
    total_high: int,
    open_critical: int,
    open_high: int,
    total_alerts: int,
    resolved_incidents: int,
    total_incidents: int,
) -> tuple[int, str]:
    """
    Calculate a security posture score (0-100).
    Higher = better security posture.
    """
    score = 100

    # Penalize for open critical alerts (-10 each, max -50)
    score -= min(open_critical * 10, 50)

    # Penalize for open high alerts (-5 each, max -25)
    score -= min(open_high * 5, 25)

    # Penalize for unresolved incident ratio
    if total_incidents > 0:
        unresolved_ratio = 1.0 - (resolved_incidents / total_incidents)
        score -= int(unresolved_ratio * 15)

    score = max(0, min(100, score))

    if score >= 90:
        grade = "A"
    elif score >= 75:
        grade = "B"
    elif score >= 60:
        grade = "C"
    elif score >= 40:
        grade = "D"
    else:
        grade = "F"

    return score, grade


@router.get(
    "/overview",
    response_model=DashboardOverview,
    status_code=status.HTTP_200_OK,
    summary="Get dashboard overview metrics",
    description="Returns aggregated SOC metrics: event/alert/incident counts, severity distribution, posture score, and recent activity feeds — all in a single efficient query bundle.",
)
async def get_dashboard_overview(
    db: AsyncSession = Depends(get_db),
) -> DashboardOverview:
    now = datetime.now(timezone.utc)
    cutoff_24h = now - timedelta(hours=24)

    # --- Aggregate counts ---
    total_events_res = await db.execute(select(func.count(SecurityEvent.id)))
    total_events = total_events_res.scalar_one() or 0

    total_alerts_res = await db.execute(select(func.count(SecurityAlert.id)))
    total_alerts = total_alerts_res.scalar_one() or 0

    total_incidents_res = await db.execute(select(func.count(Incident.id)))
    total_incidents = total_incidents_res.scalar_one() or 0

    total_inv_res = await db.execute(select(func.count(Investigation.id)))
    total_investigations = total_inv_res.scalar_one() or 0

    # --- Alerts by severity ---
    sev_res = await db.execute(
        select(SecurityAlert.severity, func.count(SecurityAlert.id))
        .group_by(SecurityAlert.severity)
    )
    sev_rows = sev_res.all()
    sev_map: Dict[str, int] = {row[0]: row[1] for row in sev_rows}
    alerts_by_severity = SeverityCount(
        CRITICAL=sev_map.get("CRITICAL", 0),
        HIGH=sev_map.get("HIGH", 0),
        MEDIUM=sev_map.get("MEDIUM", 0),
        LOW=sev_map.get("LOW", 0),
        INFORMATIONAL=sev_map.get("INFORMATIONAL", 0),
    )

    # --- Alerts by status ---
    astatus_res = await db.execute(
        select(SecurityAlert.status, func.count(SecurityAlert.id))
        .group_by(SecurityAlert.status)
    )
    astatus_rows = astatus_res.all()
    astatus_map: Dict[str, int] = {row[0]: row[1] for row in astatus_rows}
    alerts_by_status = StatusCount(
        OPEN=astatus_map.get("OPEN", 0),
        INVESTIGATING=astatus_map.get("INVESTIGATING", 0),
        RESOLVED=astatus_map.get("RESOLVED", 0),
        FALSE_POSITIVE=astatus_map.get("FALSE_POSITIVE", 0),
    )

    # --- Incidents by status ---
    istatus_res = await db.execute(
        select(Incident.status, func.count(Incident.id))
        .group_by(Incident.status)
    )
    istatus_rows = istatus_res.all()
    istatus_map: Dict[str, int] = {row[0]: row[1] for row in istatus_rows}
    incidents_by_status = StatusCount(
        OPEN=istatus_map.get("OPEN", 0),
        INVESTIGATING=istatus_map.get("INVESTIGATING", 0),
        RESOLVED=istatus_map.get("RESOLVED", 0),
        FALSE_POSITIVE=istatus_map.get("FALSE_POSITIVE", 0),
    )

    # --- Critical/High counts ---
    critical_high_alerts = (alerts_by_severity.CRITICAL + alerts_by_severity.HIGH)
    # Open critical/high split by severity band (single grouped query) so the
    # posture score penalizes the actual number of OPEN critical alerts rather
    # than the total CRITICAL count whenever any alert happens to be open.
    open_sev_res = await db.execute(
        select(SecurityAlert.severity, func.count(SecurityAlert.id))
        .where(SecurityAlert.status == "OPEN")
        .group_by(SecurityAlert.severity)
    )
    open_sev_map: Dict[str, int] = {row[0]: row[1] for row in open_sev_res.all()}
    open_critical = open_sev_map.get("CRITICAL", 0)
    open_high = open_sev_map.get("HIGH", 0)
    open_critical_high_alerts = open_critical + open_high

    # --- Posture score ---
    resolved_incidents = incidents_by_status.RESOLVED
    posture_score, posture_grade = _calculate_posture_score(
        total_critical=alerts_by_severity.CRITICAL,
        total_high=alerts_by_severity.HIGH,
        open_critical=open_critical,
        open_high=open_high,
        total_alerts=total_alerts,
        resolved_incidents=resolved_incidents,
        total_incidents=total_incidents,
    )

    # --- Last 24h counts ---
    events_24h_res = await db.execute(
        select(func.count(SecurityEvent.id)).where(SecurityEvent.ingested_at >= cutoff_24h)
    )
    events_last_24h = events_24h_res.scalar_one() or 0

    alerts_24h_res = await db.execute(
        select(func.count(SecurityAlert.id)).where(SecurityAlert.created_at >= cutoff_24h)
    )
    alerts_last_24h = alerts_24h_res.scalar_one() or 0

    incidents_24h_res = await db.execute(
        select(func.count(Incident.id)).where(Incident.created_at >= cutoff_24h)
    )
    incidents_last_24h = incidents_24h_res.scalar_one() or 0

    # --- Recent events (last 10) ---
    recent_events_res = await db.execute(
        select(SecurityEvent)
        .order_by(SecurityEvent.ingested_at.desc())
        .limit(10)
    )
    recent_events_rows = list(recent_events_res.scalars().all())
    recent_events = [
        RecentEvent(
            event_id=e.event_id,
            source=e.source,
            event_type=e.event_type,
            outcome=e.outcome,
            actor=e.actor,
            region=e.region,
            timestamp=e.timestamp.isoformat(),
            ingested_at=e.ingested_at.isoformat(),
        )
        for e in recent_events_rows
    ]

    # --- Recent alerts (last 8, ordered by created_at desc) ---
    recent_alerts_res = await db.execute(
        select(SecurityAlert)
        .order_by(SecurityAlert.created_at.desc())
        .limit(8)
    )
    recent_alerts_rows = list(recent_alerts_res.scalars().all())
    recent_alerts = [
        RecentAlert(
            alert_id=a.alert_id,
            rule_name=a.rule_name,
            severity=a.severity,
            risk_score=a.risk_score,
            title=a.title,
            status=a.status,
            first_seen=a.first_seen.isoformat(),
            occurrence_count=a.occurrence_count,
        )
        for a in recent_alerts_rows
    ]

    # --- Recent incidents (last 8) ---
    recent_incidents_res = await db.execute(
        select(Incident)
        .order_by(Incident.created_at.desc())
        .limit(8)
    )
    recent_incidents_rows = list(recent_incidents_res.scalars().all())
    recent_incidents = [
        RecentIncident(
            incident_id=i.incident_id,
            title=i.title,
            severity=i.severity,
            risk_score=i.risk_score,
            status=i.status,
            first_seen=i.first_seen.isoformat(),
            assigned_analyst=i.assigned_analyst,
        )
        for i in recent_incidents_rows
    ]

    return DashboardOverview(
        total_events=total_events,
        total_alerts=total_alerts,
        total_incidents=total_incidents,
        total_investigations=total_investigations,
        alerts_by_severity=alerts_by_severity,
        alerts_by_status=alerts_by_status,
        incidents_by_status=incidents_by_status,
        critical_high_alerts=critical_high_alerts,
        open_critical_high_alerts=open_critical_high_alerts,
        security_posture_score=posture_score,
        posture_grade=posture_grade,
        recent_events=recent_events,
        recent_alerts=recent_alerts,
        recent_incidents=recent_incidents,
        events_last_24h=events_last_24h,
        alerts_last_24h=alerts_last_24h,
        incidents_last_24h=incidents_last_24h,
        generated_at=now.isoformat(),
    )
