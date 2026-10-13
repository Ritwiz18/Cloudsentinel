from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class InvestigationCreateRequest(BaseModel):
    """
    Request payload to initiate or refresh an investigation.
    """
    force_refresh: bool = Field(
        default=False,
        description="Force execution of a new investigation even if a recent one already exists",
    )
    analyst_notes: Optional[str] = Field(
        default=None,
        description="Optional context or notes provided by the investigating security analyst",
    )


class EvidenceReferences(BaseModel):
    """
    Structured pointers to underlying evidence artifacts.
    """
    incident_id: Optional[str] = None
    alert_ids: List[str] = Field(default_factory=list)
    event_ids: List[str] = Field(default_factory=list)
    affected_resources: List[str] = Field(default_factory=list)
    actors: List[str] = Field(default_factory=list)
    source_ips: List[str] = Field(default_factory=list)


class InvestigationResponse(BaseModel):
    """
    Full investigation response representing findings, evidence separation,
    and defensive guidance.
    """
    id: int
    investigation_id: str
    incident_id: Optional[str] = None
    alert_id: Optional[str] = None

    # Core findings
    summary: str
    observed_evidence: List[str] = Field(
        default_factory=list,
        description="Observed facts extracted directly from telemetry logs and detection alerts",
    )
    detection_explanation: str
    potential_impact: str

    # Confidence and limitations
    confidence_level: str
    confidence_limitations: str

    # Actionable guidance
    recommended_steps: List[str] = Field(
        default_factory=list,
        description="Defensive remediation and forensic next steps",
    )

    # Explicitly labeled speculative hypotheses
    hypotheses: List[str] = Field(
        default_factory=list,
        description="AI-generated hypotheses, clearly separated from verified facts",
    )

    # Evidence traceability
    evidence_references: Dict[str, Any] = Field(default_factory=dict)

    # Attribution
    provider: str
    model: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InvestigationListResponse(BaseModel):
    """
    Paginated/listed investigations response.
    """
    items: List[InvestigationResponse]
    total: int
