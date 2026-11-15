"""
Dashboard overview API — returns aggregated SOC metrics in a single efficient query bundle.

All aggregate metrics are scoped to the selected analysis window so the
Command Center responds consistently to dashboard period filters.
"""
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_db
from ...models.alert import SecurityAlert
from ...models.event import SecurityEvent
from ...models.incident import Incident, IncidentAudit

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

VALID_PERIODS = {"24h", "7d", "30d", "custom", "all"}

PERIOD_DELTAS = {
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
}


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


class PostureDomain(BaseModel):
    domain: str = Field(description="Security domain: IAM, Storage, Network, Compute, Database")
    score: Optional[int] = Field(description="Domain posture score (0-100); null when no checks are implemented")
    status: str = Field(description="healthy | degraded | critical | not_implemented")
    checks_run: int = Field(description="Number of implemented detection checks for this domain")
    rationale: str = Field(description="Human-readable explanation of how the score was derived")


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
    source: Optional[str] = Field(description="Originating event source (e.g. simulator, aws.cloudtrail)")
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


class TimelineEntry(BaseModel):
    stage: str = Field(description="event_received | alert_generated | incident_created | incident_updated | incident_resolved")
    title: str
    source: Optional[str] = None
    actor: Optional[str] = None
    severity: Optional[str] = None
    timestamp: str
    detail: Optional[str] = None


class IntegrationStatus(BaseModel):
    name: str
    status: str
    details: str


class DashboardOverview(BaseModel):
    # Counts (scoped to the selected analysis window)
    total_events: int = Field(description="Total security events ingested within the selected window")
    total_alerts: int = Field(description="Total security alerts generated within the selected window")
    total_incidents: int = Field(description="Total security incidents created within the selected window")
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

    # Per-domain posture (calculated only from implemented detection checks)
    posture_by_domain: List[PostureDomain] = Field(default_factory=list)

    # Event sources observed within the window (real vs simulated telemetry)
    sources_seen: Dict[str, int] = Field(default_factory=dict)

    # Recent activity (within the selected window)
    recent_events: List[RecentEvent] = Field(default_factory=list)
    recent_alerts: List[RecentAlert] = Field(default_factory=list)
    recent_incidents: List[RecentIncident] = Field(default_factory=list)

    # Counts ingested in last 24h (independent of the selected window)
    events_last_24h: int = 0
    alerts_last_24h: int = 0
    incidents_last_24h: int = 0

    # Analysis window metadata
    period: str = Field(description="Analysis window: 24h | 7d | 30d | custom | all")
    window_start: Optional[str] = None
    window_end: Optional[str] = None

    # Timestamp
    generated_at: str


def _parse_window(period: str, start_date: Optional[date], end_date: Optional[date]) -> tuple[Optional[datetime], Optional[datetime], str, str]:
    """Resolve the analysis window from period + optional custom dates."""
    if period not in VALID_PERIODS:
        period = "24h"
    now = datetime.now(timezone.utc)

    if period == "custom":
        if start_date:
            start = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)
        else:
            start = now - timedelta(days=7)
        if end_date:
            end = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59, tzinfo=timezone.utc)
        else:
            end = now
        return start, end, period, f"custom {start.date().isoformat()} → {end.date().isoformat()}"

    if period == "all":
        return None, None, "all", "all time"

    start = now - PERIOD_DELTAS[period]
    return start, now, period, f"last {period}"


def _window_conditions(model, start: Optional[datetime], end: Optional[datetime], timestamp_column="created_at"):
    conditions = []
    column = getattr(model, timestamp_column)
    if start is not None:
        conditions.append(column >= start)
    if end is not None:
        conditions.append(column <= end)
    return conditions


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


def _domain_posture(
    db_rules_severity: Dict[str, int],
    open_by_rule: Dict[str, Dict[str, int]],
) -> List[PostureDomain]:
    """
    Derive per-domain posture only from detection checks that are actually
    implemented. Domains without implemented checks are reported as
    not_implemented instead of fabricating a score.
    """
    domains: List[PostureDomain] = []

    # IAM — covered by the Risky IAM Policy Modification rule (IAM-001)
    iam_alerts = db_rules_severity.get("IAM", 0)
    iam_open_critical = open_by_rule.get("IAM", {}).get("CRITICAL", 0)
    iam_open_high = open_by_rule.get("IAM", {}).get("HIGH", 0)
    iam_score = max(0, 100 - min(iam_open_critical * 10, 50) - min(iam_open_high * 5, 25))
    domains.append(
        PostureDomain(
            domain="IAM",
            score=iam_score,
            status="critical" if iam_open_critical > 0 else ("degraded" if iam_open_high > 0 else "healthy"),
            checks_run=1,
            rationale=(
                f"{iam_alerts} IAM policy change alert(s) generated by the implemented "
                f"IAM-001 detection rule (risky AdministratorAccess / trust policy attachments). "
                f"Penalty applied for {iam_open_critical} open critical and {iam_open_high} open high findings."
            ),
        )
    )

    # Storage — covered by the Risky Storage Configuration rule (STORAGE-001)
    storage_alerts = db_rules_severity.get("STORAGE", 0)
    storage_open_critical = open_by_rule.get("STORAGE", {}).get("CRITICAL", 0)
    storage_open_high = open_by_rule.get("STORAGE", {}).get("HIGH", 0)
    storage_score = max(0, 100 - min(storage_open_critical * 10, 50) - min(storage_open_high * 5, 25))
    domains.append(
        PostureDomain(
            domain="Storage",
            score=storage_score,
            status="critical" if storage_open_critical > 0 else ("degraded" if storage_open_high > 0 else "healthy"),
            checks_run=1,
            rationale=(
                f"{storage_alerts} storage exposure alert(s) generated by the implemented "
                f"STORAGE-001 detection rule (public ACL / Block Public Access removal). "
                f"Penalty applied for {storage_open_critical} open critical and {storage_open_high} open high findings."
            ),
        )
    )

    # Domains with no implemented detection checks: report explicitly, never fabricate.
    not_implemented_rationale = (
        "No detection rules are implemented for this domain yet; score is withheld "
        "rather than estimated. Add detection rules covering this domain to enable scoring."
    )
    for domain in ("Network", "Compute", "Database"):
        domains.append(
            PostureDomain(
                domain=domain,
                score=None,
                status="not_implemented",
                checks_run=0,
                rationale=not_implemented_rationale,
            )
        )

    return domains


def _rule_family(rule_id: str) -> str:
    """Map a rule id to its security domain family for posture attribution."""
    if rule_id.startswith("IAM"):
        return "IAM"
    if rule_id.startswith("STORAGE"):
        return "STORAGE"
    if rule_id.startswith("AUTH"):
        return "IAM"  # authentication failures are an IAM-domain concern
    if rule_id.startswith("NETWORK"):
        return "Network"
    return "Other"


@router.get(
    "/overview",
    response_model=DashboardOverview,
    status_code=status.HTTP_200_OK,
    summary="Get dashboard overview metrics",
    description="Returns aggregated SOC metrics scoped to the selected analysis window: event/alert/incident counts, severity distribution, posture score (global and per-domain), posture rationale, recent activity feeds, and observed event sources.",
)
async def get_dashboard_overview(
    db: AsyncSession = Depends(get_db),
    period: str = Query("24h", description="Analysis window: 24h, 7d, 30d, custom, all"),
    start_date: Optional[date] = Query(None, description="Custom window start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="Custom window end date (YYYY-MM-DD)"),
) -> DashboardOverview:
    now = datetime.now(timezone.utc)
    cutoff_24h = now - timedelta(hours=24)
    window_start, window_end, period_label, _window_label = _parse_window(period, start_date, end_date)
    window_conds = _window_conditions(SecurityEvent, window_start, window_end, "ingested_at")

    # --- Aggregate counts (scoped to the analysis window) ---
    total_events_res = await db.execute(select(func.count(SecurityEvent.id)).where(*window_conds))
    total_events = total_events_res.scalar_one() or 0

    alert_window_conds = _window_conditions(SecurityAlert, window_start, window_end, "created_at")
    total_alerts_res = await db.execute(select(func.count(SecurityAlert.id)).where(*alert_window_conds))
    total_alerts = total_alerts_res.scalar_one() or 0

    incident_window_conds = _window_conditions(Incident, window_start, window_end, "created_at")
    total_incidents_res = await db.execute(select(func.count(Incident.id)).where(*incident_window_conds))
    total_incidents = total_incidents_res.scalar_one() or 0

    total_inv_res = await db.execute(select(func.count(Investigation.id)))
    total_investigations = total_inv_res.scalar_one() or 0

    # --- Observed event sources within the window (real vs simulated telemetry) ---
    sources_res = await db.execute(
        select(SecurityEvent.source, func.count(SecurityEvent.id))
        .where(*window_conds)
        .group_by(SecurityEvent.source)
    )
    sources_seen: Dict[str, int] = {row[0]: row[1] for row in sources_res.all()}

    # --- Alerts by severity (within window) ---
    sev_res = await db.execute(
        select(SecurityAlert.severity, func.count(SecurityAlert.id))
        .where(*alert_window_conds)
        .group_by(SecurityAlert.severity)
    )
    sev_map: Dict[str, int] = {row[0]: row[1] for row in sev_res.all()}
    alerts_by_severity = SeverityCount(
        CRITICAL=sev_map.get("CRITICAL", 0),
        HIGH=sev_map.get("HIGH", 0),
        MEDIUM=sev_map.get("MEDIUM", 0),
        LOW=sev_map.get("LOW", 0),
        INFORMATIONAL=sev_map.get("INFORMATIONAL", 0),
    )

    # --- Alerts by status (within window) ---
    astatus_res = await db.execute(
        select(SecurityAlert.status, func.count(SecurityAlert.id))
        .where(*alert_window_conds)
        .group_by(SecurityAlert.status)
    )
    astatus_map: Dict[str, int] = {row[0]: row[1] for row in astatus_res.all()}
    alerts_by_status = StatusCount(
        OPEN=astatus_map.get("OPEN", 0),
        INVESTIGATING=astatus_map.get("INVESTIGATING", 0),
        RESOLVED=astatus_map.get("RESOLVED", 0),
        FALSE_POSITIVE=astatus_map.get("FALSE_POSITIVE", 0),
    )

    # --- Incidents by status (within window) ---
    istatus_res = await db.execute(
        select(Incident.status, func.count(Incident.id))
        .where(*incident_window_conds)
        .group_by(Incident.status)
    )
    istatus_map: Dict[str, int] = {row[0]: row[1] for row in istatus_res.all()}
    incidents_by_status = StatusCount(
        OPEN=istatus_map.get("OPEN", 0),
        INVESTIGATING=istatus_map.get("INVESTIGATING", 0),
        RESOLVED=istatus_map.get("RESOLVED", 0),
        FALSE_POSITIVE=istatus_map.get("FALSE_POSITIVE", 0),
    )

    # --- Critical/High counts ---
    critical_high_alerts = alerts_by_severity.CRITICAL + alerts_by_severity.HIGH
    open_sev_res = await db.execute(
        select(SecurityAlert.severity, func.count(SecurityAlert.id))
        .where(*alert_window_conds, SecurityAlert.status == "OPEN")
        .group_by(SecurityAlert.severity)
    )
    open_sev_map: Dict[str, int] = {row[0]: row[1] for row in open_sev_res.all()}
    open_critical = open_sev_map.get("CRITICAL", 0)
    open_high = open_sev_map.get("HIGH", 0)
    open_critical_high_alerts = open_critical + open_high

    # --- Per-domain posture and open-severity by rule family ---
    open_by_rule: Dict[str, Dict[str, int]] = {}
    open_rule_res = await db.execute(
        select(SecurityAlert.rule_id, SecurityAlert.severity, func.count(SecurityAlert.id))
        .where(*alert_window_conds, SecurityAlert.status == "OPEN")
        .group_by(SecurityAlert.rule_id, SecurityAlert.severity)
    )
    for rule_id, severity, count in open_rule_res.all():
        family = _rule_family(rule_id)
        open_by_rule.setdefault(family, {})
        open_by_rule[family][severity] = open_by_rule[family].get(severity, 0) + count

    db_rules_severity: Dict[str, int] = {}
    rule_sev_res = await db.execute(
        select(SecurityAlert.rule_id, func.count(SecurityAlert.id))
        .where(*alert_window_conds)
        .group_by(SecurityAlert.rule_id)
    )
    for rule_id, count in rule_sev_res.all():
        family = _rule_family(rule_id)
        db_rules_severity[family] = db_rules_severity.get(family, 0) + count

    posture_by_domain = _domain_posture(db_rules_severity, open_by_rule)

    # --- Posture score (global, window-scoped inputs) ---
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

    # --- Last 24h counts (fixed reference window, independent of selector) ---
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

    # --- Recent events (last 10 within window) ---
    recent_events_res = await db.execute(
        select(SecurityEvent)
        .where(*window_conds)
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

    # --- Recent alerts (last 8 within window), enriched with originating source ---
    recent_alerts_res = await db.execute(
        select(SecurityAlert)
        .where(*alert_window_conds)
        .order_by(SecurityAlert.created_at.desc())
        .limit(8)
    )
    recent_alerts_rows = list(recent_alerts_res.scalars().all())

    alert_source_by_id: Dict[str, Optional[str]] = {}
    if recent_alerts_rows:
        related_event_ids = [
            eid
            for a in recent_alerts_rows
            for eid in (a.related_event_ids or [])
        ]
        if related_event_ids:
            latest_source_res = await db.execute(
                select(SecurityEvent.event_id, SecurityEvent.source, SecurityEvent.ingested_at)
                .where(SecurityEvent.event_id.in_(related_event_ids))
                .order_by(SecurityEvent.ingested_at.desc())
            )
            best_source: Dict[str, str] = {}
            for event_id, source, ingested_at in latest_source_res.all():
                if event_id not in best_source:
                    best_source[event_id] = source
            for a in recent_alerts_rows:
                chosen: Optional[str] = None
                chosen_time = None
                for eid in (a.related_event_ids or []):
                    if eid in best_source:
                        chosen = best_source[eid]
                        break
                alert_source_by_id[a.alert_id] = chosen

    recent_alerts = [
        RecentAlert(
            alert_id=a.alert_id,
            source=alert_source_by_id.get(a.alert_id),
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

    # --- Recent incidents (last 8 within window) ---
    recent_incidents_res = await db.execute(
        select(Incident)
        .where(*incident_window_conds)
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
        posture_by_domain=posture_by_domain,
        sources_seen=sources_seen,
        recent_events=recent_events,
        recent_alerts=recent_alerts,
        recent_incidents=recent_incidents,
        events_last_24h=events_last_24h,
        alerts_last_24h=alerts_last_24h,
        incidents_last_24h=incidents_last_24h,
        period=period_label,
        window_start=window_start.isoformat() if window_start else None,
        window_end=window_end.isoformat() if window_end else None,
        generated_at=now.isoformat(),
    )


@router.get(
    "/timeline",
    response_model=List[TimelineEntry],
    status_code=status.HTTP_200_OK,
    summary="Get security activity timeline",
    description="Returns a unified chronological feed of security activity: events received, alerts generated by detection rules, and incident lifecycle changes (created, updated, resolved), with timestamps and event sources.",
)
async def get_security_timeline(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of timeline entries"),
) -> List[TimelineEntry]:
    entries: List[TimelineEntry] = []

    # Security events received (and processed at ingestion time).
    events_res = await db.execute(
        select(SecurityEvent).order_by(SecurityEvent.timestamp.desc()).limit(limit)
    )
    events = list(events_res.scalars().all())
    for e in events:
        entries.append(
            TimelineEntry(
                stage="event_received",
                title=f"Security event received: {e.event_type}",
                source=e.source,
                actor=e.actor,
                severity=e.outcome,
                timestamp=e.timestamp.isoformat(),
                detail=f"Event {e.event_id} ingested at {e.ingested_at.isoformat()}",
            )
        )

    # Alerts generated by detection rules.
    alerts_res = await db.execute(
        select(SecurityAlert).order_by(SecurityAlert.created_at.desc()).limit(limit)
    )
    alerts = list(alerts_res.scalars().all())
    alert_sources: Dict[str, Optional[str]] = {}
    if alerts:
        related_ids = [eid for a in alerts for eid in (a.related_event_ids or [])]
        if related_ids:
            latest_res = await db.execute(
                select(SecurityEvent.event_id, SecurityEvent.source)
                .where(SecurityEvent.event_id.in_(related_ids))
                .order_by(SecurityEvent.ingested_at.desc())
            )
            seen: Dict[str, str] = {}
            for event_id, source in latest_res.all():
                if event_id not in seen:
                    seen[event_id] = source
            for a in alerts:
                chosen = None
                for eid in (a.related_event_ids or []):
                    if eid in seen:
                        chosen = seen[eid]
                        break
                alert_sources[a.alert_id] = chosen
    for a in alerts:
        entries.append(
            TimelineEntry(
                stage="alert_generated",
                title=f"Alert generated: {a.rule_name}",
                source=alert_sources.get(a.alert_id),
                severity=a.severity,
                timestamp=a.created_at.isoformat(),
                detail=f"Detection rule {a.rule_id} triggered ({a.occurrence_count}× occurrence(s); risk {a.risk_score})",
            )
        )

    # Incident lifecycle changes from the immutable audit trail.
    audit_res = await db.execute(
        select(IncidentAudit).order_by(IncidentAudit.created_at.desc()).limit(limit)
    )
    audits = list(audit_res.scalars().all())
    for a in audits:
        if a.action == "CREATED":
            stage = "incident_created"
            title = f"Incident created: {a.incident_id}"
            detail = a.reason or "Incident created from correlated alert(s)"
        elif a.action == "STATUS_CHANGED":
            stage = "incident_updated"
            title = f"Incident updated: {a.incident_id}"
            new_state = a.new_state or {}
            detail = f"Status changed to {new_state.get('status', 'unknown')}"
            if a.reason:
                detail += f" — {a.reason}"
        elif a.action in ("RESOLVED", "FALSE_POSITIVE"):
            stage = "incident_resolved"
            title = f"Incident resolved: {a.incident_id}"
            detail = a.reason or f"Incident marked {a.action}"
        else:
            continue
        entries.append(
            TimelineEntry(
                stage=stage,
                title=title,
                actor=a.actor,
                timestamp=a.created_at.isoformat(),
                detail=detail,
            )
        )

    entries.sort(key=lambda item: item.timestamp, reverse=True)
    return entries[:limit]