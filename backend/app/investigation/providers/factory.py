from app.core.config import settings
from app.investigation.providers.base import BaseInvestigationProvider
from app.investigation.providers.llm_provider import LLMInvestigationProvider
from app.investigation.providers.rule_based import RuleBasedInvestigationProvider


def get_investigation_provider() -> BaseInvestigationProvider:
    """
    Factory to return the configured investigation provider.
    Defaults to RuleBasedInvestigationProvider if AI_PROVIDER is 'offline',
    empty, or no API key is provided.
    """
    provider_type = (settings.AI_PROVIDER or "").lower().strip()
    if provider_type in ("offline", "none", "", "rule-based", "rule_based"):
        return RuleBasedInvestigationProvider()

    # Otherwise instantiate LLM provider with fallback capability
    return LLMInvestigationProvider()
