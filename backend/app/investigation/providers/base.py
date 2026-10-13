from abc import ABC, abstractmethod
from app.investigation.context import InvestigationContext, InvestigationResult


class BaseInvestigationProvider(ABC):
    """
    Abstract interface for AI and rule-based investigation providers.
    All providers must produce an InvestigationResult conforming to the schema,
    guaranteeing separation of observed evidence from hypotheses.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the provider (e.g., 'offline-rule-engine', 'openai', 'gemini')."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Model or heuristic identifier."""
        pass

    @abstractmethod
    async def generate_investigation(self, context: InvestigationContext) -> InvestigationResult:
        """
        Analyze the security context and return a structured investigation result.
        """
        pass
