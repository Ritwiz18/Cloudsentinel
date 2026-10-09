import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List


def make_synthetic_metadata(scenario_name: str, extra: Dict[str, Any] = None) -> Dict[str, Any]:
    data = {
        "is_synthetic": True,
        "environment": "simulation",
        "scenario": scenario_name,
        "disclaimer": "Synthetic security test data - not real attack activity",
    }
    if extra:
        data.update(extra)
    return data


def generate_failed_authentication_events(count: int = 5, base_time: datetime = None) -> List[Dict[str, Any]]:
    """
    Produces repeated failed authentication attempts indicating potential credential stuffing / brute-force.
    """
    if base_time is None:
        base_time = datetime.now(timezone.utc) - timedelta(minutes=10)

    events = []
    target_account = "112233445566"
    actor_principal = "arn:aws:iam::112233445566:user/analyst-bob"
    attacker_ip = "203.0.113.195"

    for i in range(count):
        event_time = base_time + timedelta(seconds=i * 12)
        events.append({
            "event_id": f"syn-auth-fail-{uuid.uuid4().hex[:12]}",
            "source": "simulator",
            "event_type": "Authentication",
            "timestamp": event_time.isoformat(),
            "account_id": target_account,
            "region": "us-east-1",
            "actor": actor_principal,
            "source_ip": attacker_ip,
            "resource": "arn:aws:iam::112233445566:root",
            "outcome": "FAILURE",
            "metadata": make_synthetic_metadata(
                scenario_name="repeated_failed_authentication",
                extra={
                    "attempt_number": i + 1,
                    "error_code": "AuthFailure.IncorrectPassword",
                    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                    "mfa_used": False,
                },
            ),
        })
    return events


def generate_suspicious_iam_events(base_time: datetime = None) -> List[Dict[str, Any]]:
    """
    Produces suspicious IAM policy changes such as AdministratorAccess attachment.
    """
    if base_time is None:
        base_time = datetime.now(timezone.utc) - timedelta(minutes=5)

    return [
        {
            "event_id": f"syn-iam-policy-{uuid.uuid4().hex[:12]}",
            "source": "simulator",
            "event_type": "IAMPolicyChange",
            "timestamp": base_time.isoformat(),
            "account_id": "112233445566",
            "region": "us-east-1",
            "actor": "arn:aws:iam::112233445566:user/compromised-contractor",
            "source_ip": "198.51.100.88",
            "resource": "arn:aws:iam::112233445566:policy/AdministratorAccess",
            "outcome": "SUCCESS",
            "metadata": make_synthetic_metadata(
                scenario_name="suspicious_iam_policy_change",
                extra={
                    "api_action": "AttachUserPolicy",
                    "policy_arn": "arn:aws:iam::aws:policy/AdministratorAccess",
                    "target_user": "compromised-contractor",
                    "severity_indicator": "HIGH",
                },
            ),
        },
        {
            "event_id": f"syn-iam-role-{uuid.uuid4().hex[:12]}",
            "source": "simulator",
            "event_type": "IAMPolicyChange",
            "timestamp": (base_time + timedelta(seconds=45)).isoformat(),
            "account_id": "112233445566",
            "region": "us-east-1",
            "actor": "arn:aws:iam::112233445566:user/compromised-contractor",
            "source_ip": "198.51.100.88",
            "resource": "arn:aws:iam::112233445566:role/CrossAccountAccessRole",
            "outcome": "SUCCESS",
            "metadata": make_synthetic_metadata(
                scenario_name="suspicious_iam_trust_relationship_update",
                extra={
                    "api_action": "UpdateAssumeRolePolicy",
                    "trusted_entities": ["*"],
                    "severity_indicator": "CRITICAL",
                },
            ),
        },
    ]


def generate_risky_storage_events(base_time: datetime = None) -> List[Dict[str, Any]]:
    """
    Produces risky storage configuration findings like disabling S3 Block Public Access or public ACLs.
    """
    if base_time is None:
        base_time = datetime.now(timezone.utc) - timedelta(minutes=3)

    return [
        {
            "event_id": f"syn-s3-bpa-{uuid.uuid4().hex[:12]}",
            "source": "simulator",
            "event_type": "StorageConfiguration",
            "timestamp": base_time.isoformat(),
            "account_id": "112233445566",
            "region": "us-west-2",
            "actor": "arn:aws:iam::112233445566:user/devops-lead",
            "source_ip": "198.51.100.12",
            "resource": "arn:aws:s3:::cloudsentinel-customer-pii-vault",
            "outcome": "SUCCESS",
            "metadata": make_synthetic_metadata(
                scenario_name="risky_storage_block_public_access_removed",
                extra={
                    "api_action": "DeletePublicAccessBlock",
                    "bucket_name": "cloudsentinel-customer-pii-vault",
                    "previous_state": "AllPublicBlocksEnabled",
                    "new_state": "BlocksDisabled",
                    "risk_level": "CRITICAL",
                },
            ),
        },
        {
            "event_id": f"syn-s3-acl-{uuid.uuid4().hex[:12]}",
            "source": "simulator",
            "event_type": "StorageAccess",
            "timestamp": (base_time + timedelta(seconds=20)).isoformat(),
            "account_id": "112233445566",
            "region": "us-west-2",
            "actor": "arn:aws:iam::112233445566:user/devops-lead",
            "source_ip": "198.51.100.12",
            "resource": "arn:aws:s3:::cloudsentinel-customer-pii-vault",
            "outcome": "SUCCESS",
            "metadata": make_synthetic_metadata(
                scenario_name="risky_storage_public_read_acl",
                extra={
                    "api_action": "PutBucketAcl",
                    "acl": "public-read",
                    "risk_level": "HIGH",
                },
            ),
        },
    ]


def generate_benign_activity_events(count: int = 4, base_time: datetime = None) -> List[Dict[str, Any]]:
    """
    Produces normal, benign cloud management activity.
    """
    if base_time is None:
        base_time = datetime.now(timezone.utc) - timedelta(minutes=15)

    templates = [
        ("DescribeInstances", "EC2Read", "arn:aws:ec2:us-east-1:112233445566:instance/i-0a1b2c3d4e5f6g7h8", "us-east-1"),
        ("ListBuckets", "StorageRead", "arn:aws:s3:::*", "us-east-1"),
        ("GetCallerIdentity", "STSRead", "arn:aws:sts::112233445566:caller", "us-east-1"),
        ("DescribeSecurityGroups", "EC2Read", "arn:aws:ec2:us-east-1:112233445566:security-group/sg-012345", "us-east-1"),
    ]

    events = []
    for i in range(min(count, len(templates))):
        action, evt_type, resource, region = templates[i]
        event_time = base_time + timedelta(seconds=i * 45)
        events.append({
            "event_id": f"syn-benign-{uuid.uuid4().hex[:12]}",
            "source": "simulator",
            "event_type": evt_type,
            "timestamp": event_time.isoformat(),
            "account_id": "112233445566",
            "region": region,
            "actor": "arn:aws:iam::112233445566:role/InternalMonitoringRole",
            "source_ip": "10.0.1.15",
            "resource": resource,
            "outcome": "SUCCESS",
            "metadata": make_synthetic_metadata(
                scenario_name="normal_benign_cloud_activity",
                extra={
                    "api_action": action,
                    "routine_job": "cloudwatch-metrics-collector",
                },
            ),
        })
    return events


def generate_scenario_events(scenario: str) -> List[Dict[str, Any]]:
    scenario = scenario.lower()
    if scenario in ("auth", "authentication", "failed_auth"):
        return generate_failed_authentication_events()
    elif scenario in ("iam", "iam_policy", "iam_escalation"):
        return generate_suspicious_iam_events()
    elif scenario in ("storage", "s3", "risky_storage"):
        return generate_risky_storage_events()
    elif scenario in ("benign", "normal"):
        return generate_benign_activity_events()
    else:
        raise ValueError(f"Unknown scenario '{scenario}'. Choose from: auth, iam, storage, benign")


def generate_all_events() -> List[Dict[str, Any]]:
    return (
        generate_benign_activity_events()
        + generate_failed_authentication_events()
        + generate_suspicious_iam_events()
        + generate_risky_storage_events()
    )
