from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.event import SecurityEvent


class DetectionResult(BaseModel):
    """
    Standard structured outcome produced by a detection rule evaluation.
    """
    matched: bool = Field(..., description="Whether the rule triggered an alert")
    rule_id: str = Field(..., description="Unique codified rule identifier (e.g. AUTH-001)")
    rule_name: str = Field(..., description="Human-readable rule name")
    severity: str = Field(..., description="Assigned severity band (INFORMATIONAL, LOW, MEDIUM, HIGH, CRITICAL)")
    risk_score: int = Field(..., ge=0, le=100, description="Calculated 0-100 risk score")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence in the detection fidelity")
    title: str = Field(..., description="Concise alert title")
    description: str = Field(..., description="Detailed description of the observed suspicious activity")
    fingerprint: str = Field(..., description="Deduplication fingerprint for grouping/updating alerts")
    related_event_ids: List[str] = Field(default_factory=list, description="IDs of events triggering this detection")
    evidence: Dict[str, Any] = Field(default_factory=dict, description="Matched telemetry and indicators")
    first_seen: datetime = Field(..., description="Timestamp of first observed event in window")
    last_seen: datetime = Field(..., description="Timestamp of most recent event in window")
    occurrence_count: int = Field(default=1, ge=1, description="Number of observed occurrences in window")


class BaseRule(ABC):
    """
    Abstract interface for all deterministic threat detection rules.
    """
    rule_id: str
    rule_name: str
    description: str

    def evaluate_event(self, event: SecurityEvent) -> Optional[DetectionResult]:
        """
        Evaluates a single event. Returns DetectionResult if matched, else None.
        Default implementation returns None for batch-only rules.
        """
        return None

    def evaluate_batch(self, events: List[SecurityEvent]) -> List[DetectionResult]:
        """
        Evaluates a collection of events (e.g. for aggregation, windowing, correlation).
        Default implementation delegates to evaluate_event for each item.
        """
        results = []
        for event in events:
            res = self.evaluate_event(event)
            if res and res.matched:
                results.append(res)
        return results
