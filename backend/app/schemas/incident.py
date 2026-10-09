from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class IncidentAuditResponse(BaseModel):
    """
    Audit ledger entry reflecting changes to an incident.
    """
    id: int
    incident_id: str
    action: str
    previous_state: Optional[Dict[str, Any]] = None
    new_state: Optional[Dict[str, Any]] = None
    actor: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IncidentResponse(BaseModel):
    """
    Summary schema for security incidents.
    """
    id: int
    incident_id: str
    title: str
    summary: str
    severity: str
    risk_score: int
    status: str
    correlation_fingerprint: str
    related_alert_ids: List[str] = Field(default_factory=list)
    related_event_ids: List[str] = Field(default_factory=list)
    correlation_reasons: List[str] = Field(default_factory=list)
    first_seen: datetime
    last_seen: datetime
    assigned_analyst: Optional[str] = None
    resolution_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IncidentDetailResponse(IncidentResponse):
    """
    Detailed schema including audit history for a security incident.
    """
    audits: List[IncidentAuditResponse] = Field(default_factory=list)


class IncidentListResponse(BaseModel):
    """
    Paginated response schema for security incidents.
    """
    items: List[IncidentResponse]
    total: int
    limit: int
    offset: int


class IncidentUpdateRequest(BaseModel):
    """
    Payload for controlled incident status, assignment, and resolution updates.
    """
    status: Optional[str] = Field(
        None,
        description="Target status: OPEN, INVESTIGATING, RESOLVED, FALSE_POSITIVE",
    )
    assigned_analyst: Optional[str] = Field(
        None,
        description="Analyst identifier or email",
    )
    resolution_reason: Optional[str] = Field(
        None,
        description="Required explanation when status is RESOLVED or FALSE_POSITIVE",
    )
    change_reason: Optional[str] = Field(
        None,
        description="Optional justification note recorded in the audit trail",
    )


class CorrelationRunRequest(BaseModel):
    """
    Parameters for triggering an alert correlation run.
    """
    lookback_minutes: int = Field(default=120, ge=1, le=1440, description="Lookback window in minutes")
    window_minutes: int = Field(default=60, ge=1, le=240, description="Maximum span between correlated alerts")
    status_filter: Optional[str] = Field(default="OPEN", description="Filter alerts by status (default: OPEN)")


class CorrelationRunResponse(BaseModel):
    """
    Outcome summary of an incident correlation execution.
    """
    alerts_evaluated: int
    incidents_created: int
    incidents_updated: int
    errors: List[str] = Field(default_factory=list)
