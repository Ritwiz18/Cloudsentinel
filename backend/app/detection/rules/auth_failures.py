from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from app.detection.risk_model import calculate_risk
from app.detection.rules.base import BaseRule, DetectionResult
from app.models.event import SecurityEvent


class RepeatedAuthFailuresRule(BaseRule):
    """
    Detects repeated failed authentication attempts sharing an actor or source IP
    within a configurable time window.
    """
    rule_id = "AUTH-001"
    rule_name = "Repeated Authentication Failures"
    description = (
        "Detects multiple failed authentication events for an identity or source IP "
        "within a defined sliding window, indicating potential brute-force or credential stuffing."
    )

    def __init__(self, threshold: int = 5, window_minutes: int = 15):
        self.threshold = threshold
        self.window_minutes = window_minutes

    def evaluate_batch(self, events: List[SecurityEvent]) -> List[DetectionResult]:
        # Filter for failed authentication events
        failed_events = [
            e for e in events
            if e.event_type and e.event_type.lower() == "authentication"
            and e.outcome and e.outcome.upper() in ("FAILURE", "FAILED")
        ]

        if not failed_events:
            return []

        # Group by composite principal key (actor, source_ip)
        groups: Dict[str, List[SecurityEvent]] = defaultdict(list)
        for e in failed_events:
            actor = (e.actor or "").strip()
            source_ip = (e.source_ip or "").strip()
            # If neither is present, track under unassociated key
            key = f"actor:{actor}|ip:{source_ip}" if (actor or source_ip) else "unassociated"
            groups[key].append(e)

        results: List[DetectionResult] = []
        window_delta = timedelta(minutes=self.window_minutes)

        for group_key, group_events in groups.items():
            if len(group_events) < self.threshold:
                continue

            # Sort chronologically by event timestamp
            sorted_events = sorted(group_events, key=lambda x: x.timestamp)
            
            # Find sliding window clusters exceeding threshold
            start_idx = 0
            n = len(sorted_events)
            cluster_found: Optional[List[SecurityEvent]] = None

            while start_idx < n:
                window_start = sorted_events[start_idx].timestamp
                # Gather all events within window_delta of window_start
                cluster = [
                    e for e in sorted_events[start_idx:]
                    if (e.timestamp - window_start) <= window_delta
                ]
                if len(cluster) >= self.threshold:
                    cluster_found = cluster
                    break
                start_idx += 1

            if not cluster_found:
                continue

            first_seen = cluster_found[0].timestamp
            last_seen = cluster_found[-1].timestamp
            event_ids = [e.event_id for e in cluster_found]
            count = len(cluster_found)

            # Risk calculation: base score 45 + count scaling
            modifiers = {"volume_adjustment": min(count * 5, 25)}
            # Check if root account or high-value target is targeted
            targeted_resources = [e.resource for e in cluster_found if e.resource]
            if any("root" in (r or "").lower() for r in targeted_resources):
                modifiers["root_target"] = 15

            risk_score, severity, breakdown = calculate_risk(base_score=45, modifiers=modifiers)

            # Stable fingerprint per actor/IP group
            fingerprint = f"AUTH-001:{group_key}"

            results.append(
                DetectionResult(
                    matched=True,
                    rule_id=self.rule_id,
                    rule_name=self.rule_name,
                    severity=severity.value,
                    risk_score=risk_score,
                    confidence=0.90,
                    title=f"Repeated Authentication Failures ({count} attempts)",
                    description=(
                        f"Observed {count} failed authentication attempts within a "
                        f"{self.window_minutes}-minute detection window."
                    ),
                    fingerprint=fingerprint,
                    related_event_ids=event_ids,
                    evidence={
                        "failure_count": count,
                        "threshold": self.threshold,
                        "window_minutes": self.window_minutes,
                        "actor": cluster_found[0].actor,
                        "source_ip": cluster_found[0].source_ip,
                        "account_id": cluster_found[0].account_id,
                        "first_attempt": first_seen.isoformat(),
                        "last_attempt": last_seen.isoformat(),
                        "scoring_breakdown": breakdown,
                    },
                    first_seen=first_seen,
                    last_seen=last_seen,
                    occurrence_count=count,
                )
            )

        return results
