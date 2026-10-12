from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class AlertResponse(BaseModel):
    """
    Schema for security alert representations.
    """
    id: int = Field(..., description="Internal surrogate database key")
    alert_id: str = Field(..., description="Unique alert identifier (e.g. alt-123456789abc)")
    fingerprint: str = Field(..., description="Deduplication key for incident grouping")
    rule_id: str = Field(..., description="Triggering rule ID")
    rule_name: str = Field(..., description="Human-readable rule name")
    severity: str = Field(..., description="Assigned severity band")
    risk_score: int = Field(..., description="0-100 risk score")
    confidence: float = Field(..., description="Detection confidence score")
    title: str = Field(..., description="Alert headline title")
    description: str = Field(..., description="Detailed alert summary")
    status: str = Field(..., description="Alert lifecycle state (OPEN, INVESTIGATING, RESOLVED, FALSE_POSITIVE)")
    related_event_ids: List[str] = Field(default_factory=list, description="IDs of correlated events")
    evidence: Dict[str, Any] = Field(default_factory=dict, description="Diagnostic evidence and indicators")
    first_seen: datetime = Field(..., description="First observed event timestamp")
    last_seen: datetime = Field(..., description="Most recent observed event timestamp")
    occurrence_count: int = Field(..., description="Number of observed occurrences in alert window")
    created_at: datetime = Field(..., description="Timestamp when alert record was created")
    updated_at: datetime = Field(..., description="Timestamp when alert record was last updated")

    model_config = ConfigDict(from_attributes=True)


class AlertListResponse(BaseModel):
    """
    Paginated response schema for security alert queries.
    """
    items: List[AlertResponse]
    total: int = Field(..., ge=0, description="Total matching alerts count")
    limit: int = Field(..., ge=1, description="Page size limit")
    offset: int = Field(..., ge=0, description="Page offset")


class DetectionRunRequest(BaseModel):
    """
    Parameters for triggering a threat detection evaluation run.
    """
    limit: int = Field(default=100, ge=1, le=500, description="Max stored events to evaluate in this batch")
    lookback_minutes: int = Field(default=60, ge=1, le=1440, description="Temporal lookback boundary in minutes")
    real_only: bool = Field(default=False, description="If true, ignore synthetic events")
    auth_threshold: Optional[int] = Field(default=None, ge=1, le=50, description="Override threshold for auth failures")
    auth_window_minutes: Optional[int] = Field(default=None, ge=1, le=120, description="Override auth failure sliding window")


class DetectionRunResponse(BaseModel):
    """
    Summary outcome of a detection run execution.
    """
    events_evaluated: int = Field(..., description="Number of events inspected")
    alerts_created: int = Field(..., description="New alerts created")
    alerts_updated: int = Field(..., description="Existing alerts updated/deduplicated")
    rules_evaluated: int = Field(..., description="Number of rules evaluated")
    errors: List[str] = Field(default_factory=list, description="Non-fatal rule execution errors")
