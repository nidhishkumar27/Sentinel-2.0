
import logging

from fastapi import APIRouter, HTTPException

from app.schemas.ai import (
    EmergencyAnalysisRequest,
    EmergencyAnalysisResponse
)
from app.services.emergency_analysis_service import analyze_emergency

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post(
    "/emergency/analyze",
    response_model=EmergencyAnalysisResponse
)
def emergency_analysis(
    request: EmergencyAnalysisRequest
):
    try:
        result = analyze_emergency(
            incident=request.incident,
            user_query=request.user_query
        )

        return result

    except ValueError as exc:
        logger.warning("Emergency analysis validation failed: %s", exc)
        raise HTTPException(
            status_code=422,
            detail=str(exc)
        ) from exc

    except Exception as exc:
        logger.exception("Emergency analysis failed")

        raise HTTPException(
            status_code=502,
            detail="Emergency AI analysis is temporarily unavailable."
        ) from exc
