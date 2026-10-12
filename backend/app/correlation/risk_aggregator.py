from typing import List, Tuple
from app.models.alert import SecurityAlert

SEVERITY_RANKS = {
    "INFORMATIONAL": 0,
    "LOW": 1,
    "MEDIUM": 2,
    "HIGH": 3,
    "CRITICAL": 4,
}

RANK_TO_SEVERITY = {v: k for k, v in SEVERITY_RANKS.items()}


def aggregate_severity(severities: List[str]) -> str:
    """
    Computes the highest severity across an array of severity strings.
    """
    if not severities:
        return "LOW"
    max_rank = max(SEVERITY_RANKS.get(s.upper(), 1) for s in severities)
    return RANK_TO_SEVERITY.get(max_rank, "LOW")


def calculate_incident_metrics(alerts: List[SecurityAlert], existing_severity: str = None) -> Tuple[str, int]:
    """
    Deterministically computes the incident's overall severity and aggregate risk score.
    - Severity: Max severity among linked alerts, ensuring it never decreases from existing_severity.
    - Risk Score: Highest alert risk score plus multi-indicator diversity bonus (capped at 100).
    """
    if not alerts:
        return existing_severity or "LOW", 0

    severities = [a.severity for a in alerts]
    if existing_severity:
        severities.append(existing_severity)

    highest_severity = aggregate_severity(severities)

    # Base score is the highest individual risk score among all linked alerts
    max_single_score = max(a.risk_score for a in alerts)

    # Multi-vector diversity bonus: an attacker chaining multiple techniques carries greater risk
    distinct_rules = set(a.rule_id for a in alerts)
    diversity_bonus = min((len(distinct_rules) - 1) * 5, 15) if len(distinct_rules) > 1 else 0

    # Volume modifier: scaled by number of alerts
    volume_bonus = min(len(alerts) * 2, 10)

    final_score = min(100, max_single_score + diversity_bonus + volume_bonus)
    return highest_severity, final_score
