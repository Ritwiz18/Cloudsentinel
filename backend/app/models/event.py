from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy import DateTime, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.session import Base


class SecurityEvent(Base):
    """
    SQLAlchemy model representing a normalized cloud security event.
    """
    __tablename__ = "security_events"

    # Database internal primary key (Integer primary key ensures auto-increment on both SQLite and PostgreSQL)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Unique external event identifier
    event_id: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)

    # Event taxonomy and classification
    source: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    # Cloud context & actor identity
    account_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    region: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    actor: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    source_ip: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    resource: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)

    # Result & structured telemetry
    outcome: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    
    # Stored as column "metadata" in SQL; mapped as event_metadata to avoid collision with Base.metadata
    event_metadata: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, nullable=False, default=dict)

    # Server ingestion audit timestamp
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    __table_args__ = (
        Index("ix_security_events_type_outcome", "event_type", "outcome"),
        Index("ix_security_events_ingested_at_desc", "ingested_at"),
    )
