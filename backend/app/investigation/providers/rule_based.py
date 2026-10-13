from typing import Any, Dict, List
from app.investigation.context import InvestigationContext, InvestigationResult
from app.investigation.providers.base import BaseInvestigationProvider


class RuleBasedInvestigationProvider(BaseInvestigationProvider):
    """
    Deterministic rule-based investigation provider.
    Serves as an offline fallback and zero-cost development/testing engine.
    Derives structured findings directly from telemetry without external AI dependencies.
    """

    @property
    def provider_name(self) -> str:
        return "offline-rule-engine"

    @property
    def model_name(self) -> str:
        return "deterministic-heuristics"

    async def generate_investigation(self, context: InvestigationContext) -> InvestigationResult:
        # Build observed evidence from telemetry
        observed_evidence: List[str] = []

        # 1. Alert observations
        for alert in context.alerts:
            actor_str = f" by actor '{alert.actor}'" if alert.actor else ""
            res_str = f" on resource '{alert.affected_resource}'" if alert.affected_resource else ""
            ip_str = f" from IP '{alert.source_ip}'" if alert.source_ip else ""
            observed_evidence.append(
                f"Detection Rule Triggered: '{alert.rule_name}' ({alert.rule_id}) with severity {alert.severity} "
                f"(Risk Score: {alert.risk_score}){actor_str}{res_str}{ip_str}."
            )

        # 2. Event observations
        for event in context.events:
            t_str = event.event_time.isoformat() if hasattr(event.event_time, "isoformat") else str(event.event_time)
            actor_str = f" Principal: {event.actor}." if event.actor else ""
            res_str = f" Target Resource: {event.resource}." if event.resource else ""
            ip_str = f" Source IP: {event.source_ip}." if event.source_ip else ""
            region_str = f" Region: {event.region}." if event.region else ""
            observed_evidence.append(
                f"Verified Telemetry: [{t_str}] Action '{event.event_name}' via '{event.event_source}'.{actor_str}{res_str}{ip_str}{region_str}"
            )

        if not observed_evidence:
            observed_evidence.append(
                f"Incident '{context.incident_id}' initiated with correlation reasons: {', '.join(context.correlation_reasons) or 'Manual / Direct correlation'}."
            )

        # 3. Detection explanation
        rule_names = list({a.rule_name for a in context.alerts})
        categories = list({a.category for a in context.alerts if a.category})
        cat_str = f" across domains [{', '.join(categories)}]" if categories else ""
        if rule_names:
            detection_explanation = (
                f"Incident '{context.incident_id}' aggregated {len(context.alerts)} security alerts{cat_str}. "
                f"Primary triggered detection rules include: {', '.join(rule_names)}. "
                f"Correlation logic identified related activity within a temporal clustering window, "
                f"linking shared indicators: actors ({', '.join(context.actors) or 'N/A'}), "
                f"affected resources ({', '.join(context.affected_resources) or 'N/A'}), and "
                f"source IPs ({', '.join(context.source_ips) or 'N/A'})."
            )
        else:
            detection_explanation = (
                f"Incident '{context.incident_id}' was flagged with severity {context.severity} "
                f"and risk score {context.risk_score} based on correlation criteria: "
                f"{'; '.join(context.correlation_reasons) or 'Multiple correlated security indicators'}."
            )

        # 4. Potential impact
        impact_factors: List[str] = []
        if any("root" in a.lower() for a in context.actors):
            impact_factors.append(
                "Root account activity bypasses role-based access control and carries unrestricted administrative privileges."
            )
        if any("0.0.0.0/0" in obs or "security group" in obs.lower() for obs in observed_evidence):
            impact_factors.append(
                "Ingress rule alterations exposing services to 0.0.0.0/0 create immediate external attack surface and risk unauthenticated compromise."
            )
        if any("s3" in obs.lower() or "bucket" in obs.lower() for obs in observed_evidence):
            impact_factors.append(
                "Modifications to storage policies or bucket public access may lead to unauthorized data exposure or intellectual property exfiltration."
            )
        if any("iam" in obs.lower() or "policy" in obs.lower() for obs in observed_evidence):
            impact_factors.append(
                "Identity and access policy changes could represent persistence mechanisms or privilege escalation attempts by an adversary."
            )
        if not impact_factors:
            impact_factors.append(
                f"Security events correlated at risk level {context.severity} ({context.risk_score}/100) indicate potential threat progression or policy violation across target cloud resources."
            )
        potential_impact = " ".join(impact_factors)

        # 5. Confidence assessment & limitations
        alert_count = len(context.alerts)
        event_count = len(context.events)
        if alert_count >= 2 or event_count >= 3:
            confidence_level = "HIGH"
        elif alert_count == 1:
            confidence_level = "MEDIUM"
        else:
            confidence_level = "LOW"

        confidence_limitations = (
            "Confidence is bounded by ingested CloudTrail telemetry and configured detection rule coverage. "
            "Internal VPC packet payloads, unmonitored AWS regions, and third-party SaaS integrations "
            "outside this deployment were not evaluated. Deterministic offline heuristics used."
        )

        # 6. Recommended defensive next steps
        recommended_steps: List[str] = [
            "Verify with the designated account owner or engineer whether this observed activity was part of an approved, planned change window.",
            "Inspect CloudTrail logs for adjacent actions by the identified principals within 2 hours before and after the incident window.",
        ]
        if context.actors:
            recommended_steps.append(
                f"Review active IAM sessions and credentials for principal(s): {', '.join(context.actors)}. If unauthorized, invalidate active temporary STS tokens immediately."
            )
        if context.source_ips:
            recommended_steps.append(
                f"Cross-reference source IP(s) {', '.join(context.source_ips)} against corporate VPN egress pools and threat intelligence reputation feeds."
            )
        if context.affected_resources:
            recommended_steps.append(
                f"Audit configuration drift and revert unauthorized modifications on target resource(s): {', '.join(context.affected_resources)}."
            )
        recommended_steps.append(
            "Maintain incident timeline and require human security approval before applying automated remediation or closing the incident."
        )

        # 7. Explicitly labeled speculative hypotheses
        hypotheses: List[str] = [
            "[Hypothesis 1: Credential Exposure / Account Compromise] The principal's credentials or access keys may have been leaked, allowing an external adversary to perform unauthorized cloud operations.",
            "[Hypothesis 2: Unauthorized Operational Bypass] An authorized internal operator or automated CI/CD pipeline performed out-of-band infrastructure changes without adhering to standard change management procedures.",
            "[Hypothesis 3: Reconnaissance & Defense Evasion] The activity may be an exploratory phase of a broader multi-stage attack attempting to establish persistence or weaken cloud security posture.",
        ]

        # 8. Summary
        summary = (
            f"Automated security investigation for Incident '{context.incident_id}' ({context.title}). "
            f"Evaluated {alert_count} alert(s) and {event_count} telemetry event(s) across {len(context.affected_resources)} affected resource(s). "
            f"Overall incident risk rated {context.severity} (Score: {context.risk_score}/100)."
        )

        # 9. Evidence references
        evidence_references: Dict[str, Any] = {
            "incident_id": context.incident_id,
            "alert_ids": [a.alert_id for a in context.alerts],
            "event_ids": [e.event_id for e in context.events],
            "affected_resources": list(set(context.affected_resources)),
            "actors": list(set(context.actors)),
            "source_ips": list(set(context.source_ips)),
            "evaluation_engine": "deterministic_heuristics_v1",
        }

        return InvestigationResult(
            summary=summary,
            observed_evidence=observed_evidence,
            detection_explanation=detection_explanation,
            potential_impact=potential_impact,
            confidence_level=confidence_level,
            confidence_limitations=confidence_limitations,
            recommended_steps=recommended_steps,
            hypotheses=hypotheses,
            evidence_references=evidence_references,
            provider=self.provider_name,
            model=self.model_name,
        )
