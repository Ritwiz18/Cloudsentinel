from typing import Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.detection.service import run_detections
from app.schemas.alert import DetectionRunRequest, DetectionRunResponse

router = APIRouter(prefix="/detections", tags=["Detections"])


@router.post(
    "/run",
    response_model=DetectionRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute detection engine evaluation",
    description="Evaluates stored events against detection rules and persists deduplicated security alerts.",
)
async def trigger_detection_run(
    request: Optional[DetectionRunRequest] = None,
    db: AsyncSession = Depends(get_db),
) -> DetectionRunResponse:
    return await run_detections(db=db, request=request)
