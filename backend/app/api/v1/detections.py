from typing import Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_db
from ...detection.engine import DetectionEngine
from ...detection.rules.base import BaseRule
from ...detection.service import run_detections
from ...schemas.alert import DetectionRunRequest, DetectionRunResponse
from ...schemas.detection import DetectionRuleInfo, DetectionRuleListResponse

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


@router.get(
    "/rules",
    response_model=DetectionRuleListResponse,
    status_code=status.HTTP_200_OK,
    summary="List registered detection rules",
    description="Returns metadata for every rule currently registered in the detection engine, so the UI can build rule filters from real rules instead of hardcoded IDs.",
)
async def list_detection_rules() -> DetectionRuleListResponse:
    engine = DetectionEngine()
    rules = [
        DetectionRuleInfo(
            rule_id=rule.rule_id,
            rule_name=rule.rule_name,
            description=rule.description,
            generates_alerts=bool(getattr(rule, "generates_alerts", True)),
            evaluation_mode=(
                "batch"
                if type(rule).evaluate_batch is not BaseRule.evaluate_batch
                else "event"
            ),
        )
        for rule in engine.rules
    ]
    return DetectionRuleListResponse(rules=rules, total=len(rules))
