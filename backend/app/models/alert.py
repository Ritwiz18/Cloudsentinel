from datetime import datetime, timezone
from typing import Any, Dict, List
from sqlalchemy import DateTime, Float, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.session import Base


class SecurityAlert(Base):
    """
    SQLAlchemy model representing an identified security alert generated
    by the deterministic threat detection engine.
    """
    __tablename__ = "security_alerts"

    # Database internal primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Unique external alert identifier (e.g., alt-a1b2c3d4e5f6)
    alert_id: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)

    # Deduplication fingerprint (stable hash/key across identical incident bursts)
    fingerprint: Mapped[str] = mapped_column(String(256), nullable=False, index=True)

    # Detection taxonomy
    rule_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    rule_name: Mapped[str] = mapped_column(String(128), nullable=False)

    # Risk scoring & severity classification
    severity: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    risk_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)

    # Alert context and description
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Lifecycle status: OPEN, INVESTIGATING, RESOLVED, FALSE_POSITIVE
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="OPEN", index=True)

    # Correlated event identifiers
    related_event_ids: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)

    # Matched telemetry and diagnostic evidence
    evidence: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Temporal bounds & burst tracking
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    occurrence_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

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
        Index("ix_security_alerts_fingerprint_status", "fingerprint", "status"),
        Index("ix_security_alerts_severity_created_at", "severity", "created_at"),
    )
