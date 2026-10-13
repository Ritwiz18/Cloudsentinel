from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass
class AlertEvidenceSummary:
    alert_id: str
    rule_id: str
    rule_name: str
    severity: str
    category: str
    risk_score: int
    actor: Optional[str] = None
    affected_resource: Optional[str] = None
    source_ip: Optional[str] = None
    created_at: Optional[datetime] = None
    evidence: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EventEvidenceSummary:
    event_id: str
    event_name: str
    event_source: str
    event_time: datetime
    actor: Optional[str] = None
    resource: Optional[str] = None
    source_ip: Optional[str] = None
    region: Optional[str] = None
    payload: Dict[str, Any] = field(default_factory=dict)


@dataclass
class InvestigationContext:
    incident_id: str
    title: str
    summary: str
    severity: str
    risk_score: int
    status: str
    first_seen: datetime
    last_seen: datetime
    correlation_reasons: List[str]
    alerts: List[AlertEvidenceSummary] = field(default_factory=list)
    events: List[EventEvidenceSummary] = field(default_factory=list)
    actors: List[str] = field(default_factory=list)
    affected_resources: List[str] = field(default_factory=list)
    source_ips: List[str] = field(default_factory=list)
    analyst_notes: Optional[str] = None


@dataclass
class InvestigationResult:
    summary: str
    observed_evidence: List[str]
    detection_explanation: str
    potential_impact: str
    confidence_level: str
    confidence_limitations: str
    recommended_steps: List[str]
    hypotheses: List[str]
    evidence_references: Dict[str, Any]
    provider: str
    model: str
