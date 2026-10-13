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

    # AWS CloudTrail Integration Settings
    AWS_REGION: str = "us-east-1"
    AWS_CLOUDTRAIL_SQS_QUEUE_URL: str = ""
    AWS_S3_BUCKET: str = ""
    AWS_MAX_MESSAGES_PER_POLL: int = 10
    AWS_WAIT_TIME_SECONDS: int = 5
    AWS_VISIBILITY_TIMEOUT: int = 60
    AWS_ENDPOINT_URL: str = ""

    # AI Investigation Settings (Phase 6)
    AI_PROVIDER: str = "offline"
    AI_API_KEY: str = ""
    AI_MODEL: str = "deterministic-heuristics"
    AI_TIMEOUT_SECONDS: int = 15

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
