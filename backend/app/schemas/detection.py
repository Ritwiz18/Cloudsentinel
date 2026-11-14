from typing import List

from pydantic import BaseModel, Field


class DetectionRuleInfo(BaseModel):
    """
    Metadata for a single rule registered in the detection engine.
    Used by the frontend to build rule pickers from real registered rules
    instead of hardcoded (and potentially stale) rule IDs.
    """

    rule_id: str = Field(..., description="Unique codified rule identifier (e.g. AUTH-001)")
    rule_name: str = Field(..., description="Human-readable rule name")
    description: str = Field(..., description="What the rule detects")
    generates_alerts: bool = Field(
        ...,
        description="Whether this rule can raise security alerts (false for allowlist/filter rules)",
    )
    evaluation_mode: str = Field(
        ...,
        description="'batch' aggregates events over a window; 'event' evaluates single events",
    )


class DetectionRuleListResponse(BaseModel):
    """
    List of detection rules currently registered in the engine.
    """

    rules: List[DetectionRuleInfo]
    total: int = Field(..., ge=0, description="Number of registered rules")
