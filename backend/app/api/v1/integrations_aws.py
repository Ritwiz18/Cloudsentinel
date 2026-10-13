from typing import Any, Dict, List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.integrations.aws.worker import CloudTrailIngestionWorker

router = APIRouter(prefix="/integrations/aws", tags=["AWS Integration"])


class AWSPollRequest(BaseModel):
    max_messages: Optional[int] = Field(None, ge=1, le=10, description="Max messages to pull from SQS (1-10)")
    wait_time_seconds: Optional[int] = Field(None, ge=0, le=20, description="SQS long-poll wait time in seconds")


class AWSPollResponse(BaseModel):
    messages_received: int
    messages_deleted: int
    events_ingested: int
    duplicates_skipped: int
    records_failed: int
    errors: List[str]


class AWSStatusResponse(BaseModel):
    status: str
    region: str
    sqs_configured: bool
    s3_bucket_configured: bool
    queue_url_masked: Optional[str]
    custom_endpoint_active: bool


class RawIngestResponse(BaseModel):
    events_ingested: int
    duplicates_skipped: int
    records_failed: int


def _mask_url(url: str) -> Optional[str]:
    """Mask SQS URL to avoid exposing AWS account ID or internal parameters."""
    if not url:
        return None
    parts = url.split("/")
    if len(parts) >= 2:
        return f"{parts[0]}//.../{parts[-1]}"
    return "configured"


@router.get(
    "/status",
    response_model=AWSStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get AWS CloudTrail integration status",
    description="Returns current configuration status of AWS SQS and S3 ingestion parameters without exposing credentials.",
)
async def get_aws_integration_status() -> AWSStatusResponse:
    sqs_configured = bool(settings.AWS_CLOUDTRAIL_SQS_QUEUE_URL and settings.AWS_CLOUDTRAIL_SQS_QUEUE_URL.strip())
    s3_configured = bool(settings.AWS_S3_BUCKET and settings.AWS_S3_BUCKET.strip())
    
    return AWSStatusResponse(
        status="active" if sqs_configured else "unconfigured",
        region=settings.AWS_REGION,
        sqs_configured=sqs_configured,
        s3_bucket_configured=s3_configured,
        queue_url_masked=_mask_url(settings.AWS_CLOUDTRAIL_SQS_QUEUE_URL),
        custom_endpoint_active=bool(settings.AWS_ENDPOINT_URL),
    )


@router.post(
    "/poll",
    response_model=AWSPollResponse,
    status_code=status.HTTP_200_OK,
    summary="Poll SQS and ingest CloudTrail events",
    description="Triggers an on-demand SQS poll cycle to retrieve CloudTrail log notifications and ingest records.",
)
async def poll_cloudtrail_events(
    payload: Optional[AWSPollRequest] = None,
    db: AsyncSession = Depends(get_db),
) -> AWSPollResponse:
    worker = CloudTrailIngestionWorker()
    max_msgs = payload.max_messages if payload else None
    wait_time = payload.wait_time_seconds if payload else None

    result = await worker.process_sqs_batch(
        db=db,
        max_messages=max_msgs,
        wait_time_seconds=wait_time,
    )
    return AWSPollResponse(**result)


@router.post(
    "/ingest-raw",
    response_model=RawIngestResponse,
    status_code=status.HTTP_200_OK,
    summary="Ingest raw CloudTrail records",
    description="Directly normalizes and ingests raw CloudTrail JSON records without requiring active SQS queue.",
)
async def ingest_raw_cloudtrail(
    payload: Union[Dict[str, Any], List[Dict[str, Any]]],
    db: AsyncSession = Depends(get_db),
) -> RawIngestResponse:
    records: List[Dict[str, Any]] = []
    if isinstance(payload, list):
        records = [r for r in payload if isinstance(r, dict)]
    elif isinstance(payload, dict):
        if "Records" in payload and isinstance(payload["Records"], list):
            records = [r for r in payload["Records"] if isinstance(r, dict)]
        else:
            records = [payload]

    if not records:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Payload contains no valid CloudTrail records.",
        )

    worker = CloudTrailIngestionWorker()
    counts = await worker.ingest_raw_records(db=db, records=records)
    return RawIngestResponse(**counts)
