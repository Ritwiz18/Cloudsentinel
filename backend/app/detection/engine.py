import logging
from typing import List, Tuple
from app.detection.rules import (
    BaseRule,
    DetectionResult,
    RepeatedAuthFailuresRule,
    RiskyIAMPolicyRule,
    RiskyStorageConfigRule,
    BenignActivityFilterRule,
)
from app.models.event import SecurityEvent

logger = logging.getLogger("cloudsentinel.detection")


class DetectionEngine:
    """
    Coordinates rule evaluation over a batch of security events.
    """
    def __init__(self, auth_threshold: int = 5, auth_window_minutes: int = 15):
        self.rules: List[BaseRule] = [
            RepeatedAuthFailuresRule(threshold=auth_threshold, window_minutes=auth_window_minutes),
            RiskyIAMPolicyRule(),
            RiskyStorageConfigRule(),
            BenignActivityFilterRule(),
        ]

    def evaluate_events(self, events: List[SecurityEvent]) -> Tuple[List[DetectionResult], List[str]]:
        """
        Executes all registered rules against the event collection.
        Returns a tuple of (matched_results, error_messages).
        """
        matched_results: List[DetectionResult] = []
        errors: List[str] = []

        for rule in self.rules:
            try:
                # 1. Batch evaluation for rules implementing aggregation (e.g. AUTH-001)
                batch_results = rule.evaluate_batch(events)
                for res in batch_results:
                    if res and res.matched:
                        matched_results.append(res)
            except Exception as exc:
                err_msg = f"Rule '{rule.rule_id}' raised unexpected exception: {exc}"
                logger.error(err_msg, exc_info=True)
                errors.append(err_msg)

        return matched_results, errors
