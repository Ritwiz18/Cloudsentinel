from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


class EventBase(BaseModel):
    """
    Base attributes for a canonical security event.
    """
    event_id: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Unique event identifier (UUID or source-provided unique ID)",
        examples=["evt-789a-4bc1-9e22-001"],
    )
    source: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="Origin of the security event",
        examples=["simulator", "aws.cloudtrail", "aws.guardduty"],
    )
    event_type: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="Event classification category",
        examples=["Authentication", "IAMPolicyChange", "StorageAccess"],
    )
    timestamp: datetime = Field(
        ...,
        description="Event occurrence timestamp in UTC",
        examples=["2026-10-09T15:30:00Z"],
    )
    account_id: Optional[str] = Field(
        None,
        max_length=64,
        description="Cloud provider account or organization identifier",
        examples=["123456789012"],
    )
    region: Optional[str] = Field(
        None,
        max_length=32,
        description="Cloud region where event occurred",
        examples=["us-east-1"],
    )
    actor: Optional[str] = Field(
        None,
        max_length=128,
        description="Identity or principal initiating the action",
        examples=["arn:aws:iam::123456789012:user/dev-admin"],
    )
    source_ip: Optional[str] = Field(
        None,
        max_length=64,
        description="Originating IP address",
        examples=["198.51.100.45"],
    )
    resource: Optional[str] = Field(
        None,
        max_length=256,
        description="Target resource ARN, name, or URI",
        examples=["arn:aws:s3:::critical-finance-data"],
    )
    outcome: str = Field(
        ...,
        min_length=1,
        max_length=32,
        description="Result of the recorded action",
        examples=["SUCCESS", "FAILURE", "DENIED"],
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        validation_alias=AliasChoices("event_metadata", "metadata"),
        description="Structured additional telemetry or vendor-specific context",
        examples=[{"mfa_used": False, "user_agent": "aws-cli/2.15.0"}],
    )

    @field_validator("event_id", "source", "event_type", "outcome", mode="before")
    @classmethod
    def strip_and_validate_non_empty(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
            if not v:
                raise ValueError("Field cannot be empty or blank")
        return v

    @field_validator("timestamp", mode="after")
    @classmethod
    def normalize_to_utc(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc)


class EventCreate(EventBase):
    """
    Schema for validating incoming security event payloads.
    """
    pass


class EventResponse(EventBase):
    """
    Schema returned to clients upon querying or creating an event.
    """
    id: int = Field(..., description="Internal database surrogate key")
    ingested_at: datetime = Field(..., description="Timestamp when event was persisted by CloudSentinel in UTC")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


class EventListResponse(BaseModel):
    """
    Paginated response schema for security event queries.
    """
    items: List[EventResponse]
    total: int = Field(..., ge=0, description="Total number of matching events")
    limit: int = Field(..., ge=1, description="Page limit applied")
    offset: int = Field(..., ge=0, description="Page offset applied")
