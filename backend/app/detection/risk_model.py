from enum import Enum
from typing import Any, Dict, Tuple


class Severity(str, Enum):
    INFORMATIONAL = "INFORMATIONAL"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


def score_to_severity(score: int) -> Severity:
    """
    Deterministically maps a 0-100 risk score to a standard severity band.
    """
    if score >= 90:
        return Severity.CRITICAL
    elif score >= 70:
        return Severity.HIGH
    elif score >= 40:
        return Severity.MEDIUM
    elif score >= 20:
        return Severity.LOW
    return Severity.INFORMATIONAL


def calculate_risk(
    base_score: int,
    modifiers: Dict[str, int] = None,
    cap: int = 100,
) -> Tuple[int, Severity, Dict[str, Any]]:
    """
    Calculates a deterministic risk score and severity band with transparent breakdown.
    Modifiers can increase or decrease the base score according to specific indicators.
    """
    score = base_score
    applied_modifiers = {}

    if modifiers:
        for factor, adjustment in modifiers.items():
            score += adjustment
            applied_modifiers[factor] = adjustment

    # Constrain within bounds 0..100
    final_score = max(0, min(cap, score))
    severity = score_to_severity(final_score)

    breakdown = {
        "base_score": base_score,
        "modifiers": applied_modifiers,
        "final_score": final_score,
        "severity": severity.value,
    }
    return final_score, severity, breakdown
