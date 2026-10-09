"""CloudSentinel Models Package."""

from app.models.event import SecurityEvent
from app.models.alert import SecurityAlert

__all__ = ["SecurityEvent", "SecurityAlert"]
