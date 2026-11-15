from ...core.config import settings
from .base import BaseInvestigationProvider
from .llm_provider import LLMInvestigationProvider
from .rule_based import RuleBasedInvestigationProvider


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
