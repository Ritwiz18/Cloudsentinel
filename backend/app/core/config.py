from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "CloudSentinel"
    API_V1_STR: str = "/api/v1"

    # PostgreSQL Database
    DATABASE_URL: str = "postgresql+asyncpg://cloudsentinel_user:cloudsentinel_dev_password@127.0.0.1:5432/cloudsentinel_db"
    POSTGRES_USER: str = "cloudsentinel_user"
    POSTGRES_PASSWORD: str = "cloudsentinel_dev_password"
    POSTGRES_DB: str = "cloudsentinel_db"
    POSTGRES_HOST: str = "127.0.0.1"
    POSTGRES_PORT: int = 5432

    # Ingestion & Detection Engine Flags
    DETECTION_RULES_ENABLED: bool = True
    ALERT_SEVERITY_THRESHOLD: str = "low"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
