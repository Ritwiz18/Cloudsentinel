from typing import Optional

from app.detection.risk_model import calculate_risk
from app.detection.rules.base import BaseRule, DetectionResult
from app.models.event import SecurityEvent


class RiskyIAMPolicyRule(BaseRule):
    """
    Identifies high-risk IAM permission changes such as administrative policy attachments
    or overly permissive cross-account trust relationships.
    """
    rule_id = "IAM-001"
    rule_name = "Risky IAM Policy Modification"
    description = (
        "Detects modifications that grant extensive administrative privileges or "
        "introduce unrestricted trust relationships."
    )

    def evaluate_event(self, event: SecurityEvent) -> Optional[DetectionResult]:
        # Must be an IAM event with successful execution
        if not event.event_type or not ("iam" in event.event_type.lower() or "policy" in event.event_type.lower()):
            return None
        if not event.outcome or event.outcome.upper() != "SUCCESS":
            return None

        metadata = event.event_metadata or {}
        api_action = metadata.get("api_action", "")
        policy_arn = metadata.get("policy_arn", "")
        trusted_entities = metadata.get("trusted_entities", [])
        resource = event.resource or ""

        matched_indicator = None
        modifiers = {}
        base_score = 75

        # 1. Broad AdministratorAccess Attachment
        if api_action in ("AttachUserPolicy", "AttachRolePolicy", "AttachGroupPolicy", "PutUserPolicy"):
            is_admin_policy = (
                policy_arn.endswith("/AdministratorAccess")
                or resource.endswith("/AdministratorAccess")
                or policy_arn == "arn:aws:iam::aws:policy/AdministratorAccess"
            )
            if is_admin_policy:
                matched_indicator = "AdministrativePolicyAttached"
                modifiers["broad_admin_privilege"] = 10  # Score -> 85 (HIGH)

        # 2. Overly Permissive AssumeRole Trust Relationship Update
        elif api_action in ("UpdateAssumeRolePolicy", "CreateRole"):
            has_wildcard_trust = (
                "*" in trusted_entities
                or trusted_entities == ["*"]
                or metadata.get("severity_indicator") == "CRITICAL"
            )
            if has_wildcard_trust:
                matched_indicator = "UnrestrictedAssumeRoleTrust"
                base_score = 90
                modifiers["wildcard_principal_exposure"] = 5  # Score -> 95 (CRITICAL)

        if not matched_indicator:
            return None

        risk_score, severity, breakdown = calculate_risk(base_score=base_score, modifiers=modifiers)

        target = metadata.get("target_user") or resource or "UnknownTarget"
        title = (
            f"Overly Permissive Trust Policy on {target}"
            if matched_indicator == "UnrestrictedAssumeRoleTrust"
            else f"Administrative Policy Attached to {target}"
        )

        fingerprint = f"IAM-001:{event.account_id or 'global'}:{target}:{api_action}"

        return DetectionResult(
            matched=True,
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            severity=severity.value,
            risk_score=risk_score,
            confidence=0.95,
            title=title,
            description=(
                f"Observed risky IAM permission modification via {api_action} "
                f"affecting resource {target}."
            ),
            fingerprint=fingerprint,
            related_event_ids=[event.event_id],
            evidence={
                "matched_indicator": matched_indicator,
                "api_action": api_action,
                "policy_arn": policy_arn,
                "trusted_entities": trusted_entities,
                "target_resource": target,
                "actor": event.actor,
                "source_ip": event.source_ip,
                "account_id": event.account_id,
                "scoring_breakdown": breakdown,
            },
            first_seen=event.timestamp,
            last_seen=event.timestamp,
            occurrence_count=1,
        )
