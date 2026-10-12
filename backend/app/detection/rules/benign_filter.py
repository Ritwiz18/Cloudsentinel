from typing import Optional

from app.detection.rules.base import BaseRule, DetectionResult
from app.models.event import SecurityEvent


class BenignActivityFilterRule(BaseRule):
    """
    Explicitly identifies routine, benign cloud operations (read-only queries,
    health checks, metadata enumeration) to ensure they are never flagged as threats.
    """
    rule_id = "BENIGN-001"
    rule_name = "Benign Activity Allowlist Filter"
    description = (
        "Filters known read-only and routine operations such as DescribeInstances, "
        "ListBuckets, and GetCallerIdentity from generating security alerts."
    )

    BENIGN_ACTIONS = {
        "DescribeInstances",
        "ListBuckets",
        "GetCallerIdentity",
        "DescribeSecurityGroups",
        "DescribeVpcs",
        "DescribeSubnets",
    }

    BENIGN_EVENT_TYPES = {
        "EC2Read",
        "StorageRead",
        "STSRead",
    }

    def evaluate_event(self, event: SecurityEvent) -> Optional[DetectionResult]:
        # If an event matches normal read operations, deliberately produce no alert
        metadata = event.event_metadata or {}
        api_action = metadata.get("api_action")

        if api_action in self.BENIGN_ACTIONS or event.event_type in self.BENIGN_EVENT_TYPES:
            # Benign activity confirmed: no alert generated
            return None

        return None
