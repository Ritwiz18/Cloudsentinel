from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from app.models.alert import SecurityAlert


@dataclass
class CorrelatedIncidentCluster:
    """
    Intermediate grouping representing a set of related alerts sharing a pivot context.
    """
    fingerprint: str
    title: str
    summary: str
    primary_pivot_type: str
    primary_pivot_value: str
    account_id: Optional[str]
    alerts: List[SecurityAlert] = field(default_factory=list)
    correlation_reasons: List[str] = field(default_factory=list)


class CorrelationEngine:
    """
    Deterministic correlation engine that extracts contextual pivots from alerts,
    applies temporal window constraints, and groups related alerts into incident clusters.
    """
    def __init__(self, window_minutes: int = 60):
        self.window_minutes = window_minutes

    def _extract_alert_pivots(self, alert: SecurityAlert) -> Dict[str, Any]:
        """
        Extracts actor, IP, target resource, and cloud account from alert telemetry.
        Safely handles missing or malformed metadata.
        """
        evidence = alert.evidence or {}
        actor = (evidence.get("actor") or "").strip()
        source_ip = (evidence.get("source_ip") or "").strip()
        account_id = (evidence.get("account_id") or "").strip()
        target_resource = (
            evidence.get("target_resource")
            or evidence.get("bucket_name")
            or ""
        ).strip()

        if not account_id and actor and "arn:aws:" in actor:
            parts = actor.split(":")
            if len(parts) >= 5 and parts[4].isdigit():
                account_id = parts[4]

        return {
            "actor": actor or None,
            "source_ip": source_ip or None,
            "account_id": account_id or None,
            "target_resource": target_resource or None,
        }

    def correlate_alerts(self, alerts: List[SecurityAlert]) -> List[CorrelatedIncidentCluster]:
        """
        Groups alerts into coherent clusters based on shared identity, infrastructure, or attack target.
        """
        if not alerts:
            return []

        # Sort chronologically by first_seen
        sorted_alerts = sorted(alerts, key=lambda a: a.first_seen)

        # Build pivot buckets
        # Hierarchy: 1) Actor principal, 2) Originating IP, 3) Targeted resource, 4) Isolated alert
        clusters_by_key: Dict[str, List[SecurityAlert]] = defaultdict(list)
        pivot_metadata: Dict[str, Tuple[str, str, Optional[str]]] = {}

        for alert in sorted_alerts:
            pivots = self._extract_alert_pivots(alert)
            actor = pivots["actor"]
            source_ip = pivots["source_ip"]
            account_id = pivots["account_id"]
            resource = pivots["target_resource"]

            if actor:
                key = f"INC:actor:{account_id or 'global'}:{actor}"
                pivot_metadata[key] = ("actor", actor, account_id)
            elif source_ip:
                key = f"INC:ip:{account_id or 'global'}:{source_ip}"
                pivot_metadata[key] = ("source_ip", source_ip, account_id)
            elif resource:
                key = f"INC:resource:{account_id or 'global'}:{resource}"
                pivot_metadata[key] = ("resource", resource, account_id)
            else:
                # Isolated alert without common pivot
                key = f"INC:isolated:{alert.alert_id}"
                pivot_metadata[key] = ("alert", alert.alert_id, account_id)

            clusters_by_key[key].append(alert)

        incident_clusters: List[CorrelatedIncidentCluster] = []
        window_delta = timedelta(minutes=self.window_minutes)

        for key, alert_group in clusters_by_key.items():
            pivot_type, pivot_value, account_id = pivot_metadata[key]

            # Enforce temporal window: partition into window-aligned subclusters
            subclusters: List[List[SecurityAlert]] = []
            current_subcluster: List[SecurityAlert] = []

            for alert in alert_group:
                if not current_subcluster:
                    current_subcluster.append(alert)
                else:
                    # Check if alert falls within window of the active subcluster's earliest or latest event
                    earliest_in_sub = current_subcluster[0].first_seen
                    if (alert.first_seen - earliest_in_sub) <= window_delta:
                        current_subcluster.append(alert)
                    else:
                        subclusters.append(current_subcluster)
                        current_subcluster = [alert]
            if current_subcluster:
                subclusters.append(current_subcluster)

            for idx, subcluster_alerts in enumerate(subclusters):
                # Unique fingerprint per temporal window cluster
                fingerprint = key if len(subclusters) == 1 else f"{key}:w{idx}"
                reasons: List[str] = []

                if pivot_type == "actor":
                    title = f"Suspicious Activity Cluster on Principal {pivot_value}"
                    reasons.append(f"Linked by shared actor principal: {pivot_value}")
                elif pivot_type == "source_ip":
                    title = f"Multi-Alert Burst Originating from IP {pivot_value}"
                    reasons.append(f"Linked by shared originating source IP: {pivot_value}")
                elif pivot_type == "resource":
                    title = f"Targeted Activity on Resource {pivot_value}"
                    reasons.append(f"Linked by shared target resource: {pivot_value}")
                else:
                    title = f"Security Alert: {subcluster_alerts[0].title}"
                    reasons.append(f"Single isolated alert: {subcluster_alerts[0].rule_name}")

                if account_id:
                    reasons.append(f"Target cloud account scope: {account_id}")

                reasons.append(f"Temporal clustering within {self.window_minutes}-minute correlation window")

                distinct_rule_names = sorted(list(set(a.rule_name for a in subcluster_alerts)))
                summary = (
                    f"Correlated incident involving {len(subcluster_alerts)} alerts across "
                    f"{len(distinct_rule_names)} distinct detection rules: {', '.join(distinct_rule_names)}."
                )

                incident_clusters.append(
                    CorrelatedIncidentCluster(
                        fingerprint=fingerprint,
                        title=title,
                        summary=summary,
                        primary_pivot_type=pivot_type,
                        primary_pivot_value=pivot_value,
                        account_id=account_id,
                        alerts=subcluster_alerts,
                        correlation_reasons=reasons,
                    )
                )

        return incident_clusters
