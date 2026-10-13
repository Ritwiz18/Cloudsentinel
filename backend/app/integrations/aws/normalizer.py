import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union
from pydantic import ValidationError

from app.schemas.event import EventCreate

logger = logging.getLogger("cloudsentinel.integrations.aws.normalizer")


class CloudTrailParseError(Exception):
    """Raised when a CloudTrail record is malformed or cannot be normalized."""
    pass


def _parse_timestamp(raw_time: Any) -> datetime:
    """Parse CloudTrail eventTime string to timezone-aware UTC datetime."""
    if isinstance(raw_time, datetime):
        if raw_time.tzinfo is None:
            return raw_time.replace(tzinfo=timezone.utc)
        return raw_time.astimezone(timezone.utc)

    if not isinstance(raw_time, str) or not raw_time.strip():
        raise CloudTrailParseError("Missing or invalid eventTime in CloudTrail record")

    raw_str = raw_time.strip()
    # Normalize Z to +00:00 for ISO parsing
    if raw_str.endswith("Z"):
        raw_str = raw_str[:-1] + "+00:00"

    try:
        dt = datetime.fromisoformat(raw_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except (ValueError, TypeError) as exc:
        raise CloudTrailParseError(f"Failed to parse eventTime '{raw_time}': {exc}") from exc


def _extract_actor(user_identity: Dict[str, Any], account_id: Optional[str]) -> str:
    """Extract canonical actor ARN or principal name from userIdentity."""
    if not isinstance(user_identity, dict):
        return "UnknownPrincipal"

    arn = user_identity.get("arn")
    if arn and isinstance(arn, str) and arn.strip():
        return arn.strip()

    identity_type = user_identity.get("type", "")
    user_name = user_identity.get("userName")

    if identity_type == "Root":
        if account_id:
            return f"arn:aws:iam::{account_id}:root"
        return "arn:aws:iam::root:root"

    if user_name and isinstance(user_name, str) and user_name.strip():
        if account_id:
            return f"arn:aws:iam::{account_id}:user/{user_name.strip()}"
        return user_name.strip()

    principal_id = user_identity.get("principalId")
    if principal_id and isinstance(principal_id, str) and principal_id.strip():
        return principal_id.strip()

    return "UnknownPrincipal"


def _extract_resource(
    event_source: str,
    event_name: str,
    req_params: Dict[str, Any],
    resources: List[Dict[str, Any]],
    user_identity: Dict[str, Any],
    account_id: Optional[str],
) -> Optional[str]:
    """Extract relevant target resource ARN or identifier based on event category."""
    # 1. Direct resources list from CloudTrail
    if isinstance(resources, list) and resources:
        first_res = resources[0]
        if isinstance(first_res, dict):
            arn = first_res.get("ARN") or first_res.get("arn")
            if arn and isinstance(arn, str) and arn.strip():
                return arn.strip()

    # 2. S3 Bucket / Object events
    if "s3" in event_source.lower() and isinstance(req_params, dict):
        bucket_name = req_params.get("bucketName")
        if bucket_name:
            key = req_params.get("key")
            return f"arn:aws:s3:::{bucket_name}/{key}" if key else f"arn:aws:s3:::{bucket_name}"

    # 3. IAM Policy / Role events
    if "iam" in event_source.lower() and isinstance(req_params, dict):
        policy_arn = req_params.get("policyArn")
        if policy_arn and isinstance(policy_arn, str):
            return policy_arn.strip()
        role_name = req_params.get("roleName")
        if role_name and account_id:
            return f"arn:aws:iam::{account_id}:role/{role_name}"
        user_name = req_params.get("userName")
        if user_name and account_id:
            return f"arn:aws:iam::{account_id}:user/{user_name}"

    # 4. Signin / Authentication events
    if "signin" in event_source.lower() or event_name == "ConsoleLogin":
        if isinstance(user_identity, dict) and user_identity.get("type") == "Root":
            return f"arn:aws:iam::{account_id}:root" if account_id else "arn:aws:iam::root:root"
        user_arn = user_identity.get("arn") if isinstance(user_identity, dict) else None
        if user_arn:
            return user_arn

    # Fallback to general request parameters
    if isinstance(req_params, dict):
        for candidate_key in ("resourceArn", "resourceName", "targetResource", "functionName"):
            val = req_params.get(candidate_key)
            if val and isinstance(val, str):
                return val.strip()

    return None


def _classify_event_type(event_source: str, event_name: str) -> str:
    """Categorize CloudTrail action into canonical CloudSentinel event types."""
    src = (event_source or "").lower()
    name = (event_name or "").lower()

    if "signin" in src or name in ("consolelogin", "checkmfa", "passwordrecovery", "credentialverification"):
        return "Authentication"

    if "iam" in src or "policy" in name or "role" in name or "saml" in name:
        return "IAMPolicyChange"

    if "s3" in src or "storage" in src:
        if any(keyword in name for keyword in ("publicaccess", "acl", "policy", "encryption", "cors", "lifecycle")):
            return "StorageConfiguration"
        return "StorageAccess"

    if "ec2" in src:
        if name.startswith("describe") or name.startswith("get"):
            return "EC2Read"
        return "EC2Configuration"

    if "sts" in src:
        if name == "getcalleridentity":
            return "STSRead"
        return "IAMPolicyChange"

    # Default to service classification
    prefix = src.split(".")[0] if "." in src else src
    return f"{prefix.upper()}Event" if prefix else "AWSEvent"


def _determine_outcome(record: Dict[str, Any]) -> str:
    """Determine outcome (SUCCESS vs FAILURE) from error fields and response elements."""
    error_code = record.get("errorCode")
    error_message = record.get("errorMessage")
    if error_code or error_message:
        return "FAILURE"

    response_elements = record.get("responseElements")
    if isinstance(response_elements, dict):
        console_login = response_elements.get("ConsoleLogin")
        if console_login and str(console_login).lower() in ("failure", "failed"):
            return "FAILURE"

    return "SUCCESS"


def _extract_trusted_entities(req_params: Dict[str, Any]) -> List[str]:
    """Extract trusted principals from assume role policy document if present."""
    if not isinstance(req_params, dict):
        return []

    policy_doc = req_params.get("policyDocument")
    if not policy_doc:
        return []

    # If policyDocument is a stringified JSON
    if isinstance(policy_doc, str):
        try:
            policy_doc = json.loads(policy_doc)
        except Exception:
            return []

    if not isinstance(policy_doc, dict):
        return []

    entities: List[str] = []
    statements = policy_doc.get("Statement", [])
    if isinstance(statements, dict):
        statements = [statements]

    for stmt in statements:
        if isinstance(stmt, dict) and stmt.get("Effect") == "Allow":
            principal = stmt.get("Principal", {})
            if principal == "*":
                entities.append("*")
            elif isinstance(principal, dict):
                aws_val = principal.get("AWS")
                if aws_val == "*":
                    entities.append("*")
                elif isinstance(aws_val, list):
                    entities.extend(str(item) for item in aws_val)
                elif aws_val:
                    entities.append(str(aws_val))
    return entities


def normalize_cloudtrail_record(record: Union[Dict[str, Any], str]) -> EventCreate:
    """
    Normalizes a raw AWS CloudTrail log record into CloudSentinel's EventCreate schema.

    Enforces deterministic event_id generation, robust timestamp normalization,
    principal and resource extraction, and contextual metadata enrichment for
    downstream detection rules.
    """
    if isinstance(record, str):
        try:
            record = json.loads(record)
        except json.JSONDecodeError as exc:
            raise CloudTrailParseError(f"Malformed JSON string: {exc}") from exc

    if not isinstance(record, dict):
        raise CloudTrailParseError(f"CloudTrail record must be a dict, got {type(record).__name__}")

    event_name = str(record.get("eventName") or "").strip()
    event_source = str(record.get("eventSource") or "").strip()
    if not event_name or not event_source:
        raise CloudTrailParseError("CloudTrail record is missing mandatory 'eventName' or 'eventSource'")

    timestamp = _parse_timestamp(record.get("eventTime"))

    user_identity = record.get("userIdentity") or {}
    if not isinstance(user_identity, dict):
        user_identity = {}

    account_id = str(record.get("recipientAccountId") or user_identity.get("accountId") or "").strip() or None
    region = str(record.get("awsRegion") or "").strip() or None
    actor = _extract_actor(user_identity, account_id)
    source_ip = str(record.get("sourceIPAddress") or "").strip() or None

    req_params = record.get("requestParameters")
    if not isinstance(req_params, dict):
        req_params = {}

    resources = record.get("resources") or []
    if not isinstance(resources, list):
        resources = []

    resource = _extract_resource(
        event_source=event_source,
        event_name=event_name,
        req_params=req_params,
        resources=resources,
        user_identity=user_identity,
        account_id=account_id,
    )

    event_type = _classify_event_type(event_source, event_name)
    outcome = _determine_outcome(record)

    # Event ID: use CloudTrail's eventID or compute deterministic SHA256 fallback
    raw_event_id = record.get("eventID")
    if raw_event_id and isinstance(raw_event_id, str) and raw_event_id.strip():
        event_id = raw_event_id.strip()
    else:
        seed = f"{timestamp.isoformat()}|{event_source}|{event_name}|{actor}|{source_ip}|{resource}"
        event_id = f"ct-{hashlib.sha256(seed.encode('utf-8')).hexdigest()[:24]}"

    # Enrich metadata for detection rules
    trusted_entities = _extract_trusted_entities(req_params)
    metadata: Dict[str, Any] = {
        "api_action": event_name,
        "aws_event_source": event_source,
        "aws_event_name": event_name,
        "is_synthetic": False,
        "raw_event_id": raw_event_id,
    }

    if user_identity:
        metadata["raw_user_identity"] = user_identity
    if record.get("errorCode"):
        metadata["error_code"] = record["errorCode"]
    if record.get("errorMessage"):
        metadata["error_message"] = record["errorMessage"]
    if record.get("userAgent"):
        metadata["user_agent"] = record["userAgent"]

    # IAM rule fields
    if req_params.get("policyArn"):
        metadata["policy_arn"] = req_params["policyArn"]
    if req_params.get("userName"):
        metadata["target_user"] = req_params["userName"]
    if trusted_entities:
        metadata["trusted_entities"] = trusted_entities

    # Storage rule fields
    if req_params.get("bucketName"):
        metadata["bucket_name"] = req_params["bucketName"]
    if req_params.get("acl"):
        metadata["acl"] = req_params["acl"]
    elif req_params.get("AccessControlPolicy"):
        # Handle stringified ACL
        acp = req_params["AccessControlPolicy"]
        if isinstance(acp, dict):
            metadata["acl"] = acp.get("Grants", "")
    if event_name == "DeletePublicAccessBlock":
        metadata["new_state"] = "BlocksDisabled"
    elif event_name == "PutBucketPublicAccessBlock":
        metadata["new_state"] = "PublicAccessBlockUpdated"

    # Additional event data (e.g. MFAUsed)
    add_data = record.get("additionalEventData")
    if isinstance(add_data, dict):
        if "MFAUsed" in add_data:
            metadata["mfa_used"] = add_data["MFAUsed"] == "Yes"

    try:
        return EventCreate(
            event_id=event_id,
            source="aws.cloudtrail",
            event_type=event_type,
            timestamp=timestamp,
            account_id=account_id,
            region=region,
            actor=actor,
            source_ip=source_ip,
            resource=resource,
            outcome=outcome,
            metadata=metadata,
        )
    except ValidationError as val_err:
        raise CloudTrailParseError(f"Normalized event failed schema validation: {val_err}") from val_err
