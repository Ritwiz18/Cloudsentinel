from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.session import Base


class Investigation(Base):
    """
    SQLAlchemy model representing an AI-assisted or rule-based investigation report
    associated with a security incident or alert.
    """
    __tablename__ = "security_investigations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Unique external identifier (e.g., inv-a1b2c3d4e5f6)
    investigation_id: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)

    # Target incident or alert linkage
    incident_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    alert_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)

    # Investigation findings
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    observed_evidence: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)
    detection_explanation: Mapped[str] = mapped_column(Text, nullable=False)
    potential_impact: Mapped[str] = mapped_column(Text, nullable=False)

    # Confidence assessment
    confidence_level: Mapped[str] = mapped_column(String(32), nullable=False, default="MEDIUM")
    confidence_limitations: Mapped[str] = mapped_column(Text, nullable=False)

    # Actionable guidance
    recommended_steps: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)

    # Explicitly labeled AI-generated hypotheses (speculative)
    hypotheses: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)

    # Evidence IDs and resource pointers
    evidence_references: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    # Provider and model attribution
    provider: Mapped[str] = mapped_column(String(64), nullable=False, default="offline-rule-engine")
    model: Mapped[str] = mapped_column(String(64), nullable=False, default="deterministic-heuristics")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    __table_args__ = (
        Index("ix_security_investigations_incident_created", "incident_id", "created_at"),
    )
