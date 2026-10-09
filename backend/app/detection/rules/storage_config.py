from typing import Optional

from app.detection.risk_model import calculate_risk
from app.detection.rules.base import BaseRule, DetectionResult
from app.models.event import SecurityEvent


class RiskyStorageConfigRule(BaseRule):
    """
    Detects risky cloud storage modifications that remove public access block controls
    or grant anonymous/public read permissions.
    """
    rule_id = "STORAGE-001"
    rule_name = "Risky Storage Configuration Change"
    description = (
        "Identifies removal of S3 Block Public Access protections or addition of "
        "public-read access control lists on cloud storage buckets."
    )

    def evaluate_event(self, event: SecurityEvent) -> Optional[DetectionResult]:
        # Must be a storage event with successful execution
        if not event.event_type or not ("storage" in event.event_type.lower() or "s3" in event.event_type.lower()):
            return None
        if not event.outcome or event.outcome.upper() != "SUCCESS":
            return None

        metadata = event.event_metadata or {}
        api_action = metadata.get("api_action", "")
        acl = metadata.get("acl", "")
        new_state = metadata.get("new_state", "")
        bucket_name = metadata.get("bucket_name") or (event.resource or "").split(":::")[-1] or "UnknownBucket"

        matched_indicator = None
        base_score = 75
        modifiers = {}

        # 1. Removal of Block Public Access protection
        if api_action == "DeletePublicAccessBlock" or new_state == "BlocksDisabled":
            matched_indicator = "PublicAccessBlockRemoved"
            base_score = 90  # CRITICAL
            modifiers["exposure_blast_radius"] = 2

        # 2. Public Read ACL grant
        elif api_action in ("PutBucketAcl", "PutObjectAcl") and acl in ("public-read", "public-read-write"):
            matched_indicator = "PublicReadAclEnabled"
            base_score = 75  # HIGH
            if acl == "public-read-write":
                modifiers["public_write_risk"] = 15

        if not matched_indicator:
            return None

        risk_score, severity, breakdown = calculate_risk(base_score=base_score, modifiers=modifiers)

        title = (
            f"S3 Public Access Block Disabled on {bucket_name}"
            if matched_indicator == "PublicAccessBlockRemoved"
            else f"Public Read ACL Applied on {bucket_name}"
        )

        fingerprint = f"STORAGE-001:{event.account_id or 'global'}:{bucket_name}:{api_action}"

        return DetectionResult(
            matched=True,
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            severity=severity.value,
            risk_score=risk_score,
            confidence=0.95,
            title=title,
            description=(
                f"Observed storage exposure configuration via {api_action} "
                f"on bucket '{bucket_name}'."
            ),
            fingerprint=fingerprint,
            related_event_ids=[event.event_id],
            evidence={
                "matched_indicator": matched_indicator,
                "api_action": api_action,
                "bucket_name": bucket_name,
                "acl": acl,
                "new_state": new_state,
                "actor": event.actor,
                "source_ip": event.source_ip,
                "scoring_breakdown": breakdown,
            },
            first_seen=event.timestamp,
            last_seen=event.timestamp,
            occurrence_count=1,
        )
