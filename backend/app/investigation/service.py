import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.investigation.context import (
    AlertEvidenceSummary,
    EventEvidenceSummary,
    InvestigationContext,
)
from app.investigation.providers.factory import get_investigation_provider
from app.models.alert import SecurityAlert
from app.models.event import SecurityEvent
from app.models.incident import Incident
from app.models.investigation import Investigation

logger = logging.getLogger("cloudsentinel.investigation.service")


class IncidentNotFoundError(Exception):
    def __init__(self, incident_id: str):
        super().__init__(f"Incident '{incident_id}' was not found.")
        self.incident_id = incident_id


class InvestigationNotFoundError(Exception):
    def __init__(self, investigation_id: str):
        super().__init__(f"Investigation '{investigation_id}' was not found.")
        self.investigation_id = investigation_id


async def investigate_incident(
    db: AsyncSession,
    incident_id: str,
    force_refresh: bool = False,
    analyst_notes: Optional[str] = None,
) -> Investigation:
    """
    Executes or retrieves an AI-assisted investigation for a specified incident.
    
    1. Looks up the Incident record.
    2. Checks for existing investigations (deduplication if force_refresh is False).
    3. Retrieves correlated SecurityAlert records and SecurityEvent telemetry.
    4. Compiles structured InvestigationContext.
    5. Calls the configured investigation provider (with fallback).
    6. Persists and returns the new Investigation model.
    """
    # 1. Fetch incident
    stmt = select(Incident).where(Incident.incident_id == incident_id)
    result = await db.execute(stmt)
    incident = result.scalar_one_or_none()

    if not incident:
        raise IncidentNotFoundError(incident_id)

    # 2. Check for existing investigation if not force_refresh
    if not force_refresh:
        existing_stmt = (
            select(Investigation)
            .where(Investigation.incident_id == incident_id)
            .order_by(desc(Investigation.created_at))
            .limit(1)
        )
        existing_res = await db.execute(existing_stmt)
        existing_inv = existing_res.scalar_one_or_none()
        if existing_inv:
            logger.info(f"Returning cached investigation '{existing_inv.investigation_id}' for incident '{incident_id}'.")
            return existing_inv

    # 3. Fetch correlated alerts
    alerts: List[SecurityAlert] = []
    if incident.related_alert_ids:
        alert_stmt = select(SecurityAlert).where(SecurityAlert.alert_id.in_(incident.related_alert_ids))
        alert_res = await db.execute(alert_stmt)
        alerts = list(alert_res.scalars().all())

    # 4. Fetch correlated events
    event_ids = list(incident.related_event_ids or [])
    for a in alerts:
        for ev_id in (a.related_event_ids or []):
            if ev_id not in event_ids:
                event_ids.append(ev_id)

    events: List[SecurityEvent] = []
    if event_ids:
        event_stmt = select(SecurityEvent).where(SecurityEvent.event_id.in_(event_ids))
        event_res = await db.execute(event_stmt)
        events = list(event_res.scalars().all())

    # 5. Build structured context
    alert_summaries = []
    for a in alerts:
        ev = a.evidence or {}
        alert_summaries.append(
            AlertEvidenceSummary(
                alert_id=a.alert_id,
                rule_id=a.rule_id,
                rule_name=a.rule_name,
                severity=a.severity,
                category=ev.get("category", "Threat Detection"),
                risk_score=a.risk_score,
                actor=ev.get("actor"),
                affected_resource=ev.get("affected_resource") or ev.get("resource"),
                source_ip=ev.get("source_ip"),
                created_at=a.created_at,
                evidence=ev,
            )
        )

    event_summaries = [
        EventEvidenceSummary(
            event_id=e.event_id,
            event_name=e.event_type,
            event_source=e.source,
            event_time=e.timestamp,
            actor=e.actor,
            resource=e.resource,
            source_ip=e.source_ip,
            region=e.region,
            payload=e.event_metadata or {},
        )
        for e in events
    ]

    actors = list({s.actor for s in alert_summaries if s.actor} | {e.actor for e in events if e.actor})
    resources = list({s.affected_resource for s in alert_summaries if s.affected_resource} | {e.resource for e in events if e.resource})
    source_ips = list({s.source_ip for s in alert_summaries if s.source_ip} | {e.source_ip for e in events if e.source_ip})

    context = InvestigationContext(
        incident_id=incident.incident_id,
        title=incident.title,
        summary=incident.summary,
        severity=incident.severity,
        risk_score=incident.risk_score,
        status=incident.status,
        first_seen=incident.first_seen,
        last_seen=incident.last_seen,
        correlation_reasons=incident.correlation_reasons or [],
        alerts=alert_summaries,
        events=event_summaries,
        actors=actors,
        affected_resources=resources,
        source_ips=source_ips,
        analyst_notes=analyst_notes,
    )

    # 6. Generate investigation findings
    provider = get_investigation_provider()
    result_data = await provider.generate_investigation(context)

    # 7. Persist to database
    investigation_id = f"inv-{uuid.uuid4().hex[:12]}"
    investigation = Investigation(
        investigation_id=investigation_id,
        incident_id=incident.incident_id,
        alert_id=None,
        summary=result_data.summary,
        observed_evidence=result_data.observed_evidence,
        detection_explanation=result_data.detection_explanation,
        potential_impact=result_data.potential_impact,
        confidence_level=result_data.confidence_level,
        confidence_limitations=result_data.confidence_limitations,
        recommended_steps=result_data.recommended_steps,
        hypotheses=result_data.hypotheses,
        evidence_references=result_data.evidence_references,
        provider=result_data.provider,
        model=result_data.model,
        created_at=datetime.now(timezone.utc),
    )

    db.add(investigation)
    await db.commit()
    await db.refresh(investigation)

    logger.info(
        f"Investigation '{investigation_id}' created for incident '{incident_id}' by provider '{result_data.provider}'."
    )
    return investigation


async def list_investigations_for_incident(
    db: AsyncSession,
    incident_id: str,
) -> List[Investigation]:
    """
    Returns all historical investigations linked to a specific incident.
    """
    # Verify incident exists
    stmt = select(Incident).where(Incident.incident_id == incident_id)
    res = await db.execute(stmt)
    if not res.scalar_one_or_none():
        raise IncidentNotFoundError(incident_id)

    inv_stmt = (
        select(Investigation)
        .where(Investigation.incident_id == incident_id)
        .order_by(desc(Investigation.created_at))
    )
    inv_res = await db.execute(inv_stmt)
    return list(inv_res.scalars().all())


async def get_investigation_by_id(
    db: AsyncSession,
    investigation_id: str,
) -> Investigation:
    """
    Retrieves a single investigation by its unique identifier.
    """
    stmt = select(Investigation).where(Investigation.investigation_id == investigation_id)
    res = await db.execute(stmt)
    investigation = res.scalar_one_or_none()
    if not investigation:
        raise InvestigationNotFoundError(investigation_id)
    return investigation
