from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.session import Base


class Incident(Base):
    """
    SQLAlchemy model representing a correlated security incident grouped from related alerts.
    """
    __tablename__ = "security_incidents"

    # Database internal primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Public unique incident identifier (e.g., inc-a1b2c3d4e5f6)
    incident_id: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)

    # Incident summary & title
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)

    # Aggregated severity band & risk score
    severity: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    risk_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Incident lifecycle status: OPEN, INVESTIGATING, RESOLVED, FALSE_POSITIVE
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="OPEN", index=True)

    # Deterministic deduplication & grouping key
    correlation_fingerprint: Mapped[str] = mapped_column(String(256), nullable=False, index=True)

    # Associated alerts and underlying events
    related_alert_ids: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)
    related_event_ids: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)

    # Structured explanations of why alerts were linked
    correlation_reasons: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)

    # Temporal boundaries across linked alerts
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    # Management & resolution tracking
    assigned_analyst: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    resolution_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Audit timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("ix_security_incidents_fingerprint_status", "correlation_fingerprint", "status"),
        Index("ix_security_incidents_severity_created_at", "severity", "created_at"),
    )


class IncidentAudit(Base):
    """
    Append-only audit ledger tracking lifecycle transitions and management actions for incidents.
    """
    __tablename__ = "incident_audits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    previous_state: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    new_state: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    actor: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
