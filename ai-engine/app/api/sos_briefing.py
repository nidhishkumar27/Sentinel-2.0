
import logging

from fastapi import APIRouter, HTTPException

from app.schemas.sos_briefing import (
    SOSBriefingRequest,
    SOSBriefingResponse,
)
from app.services.sos_briefing_service import generate_sos_briefings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/sos-briefing",
    response_model=SOSBriefingResponse
)
def create_sos_briefing(
    request: SOSBriefingRequest
):
    try:
        return generate_sos_briefings(
            incident=request.incident,
            user_query=request.user_query
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc)
        ) from exc

    except Exception as exc:
        logger.exception("SOS briefing generation failed.")

        raise HTTPException(
            status_code=502,
            detail="SOS briefing generation failed. Check AI service logs."
        ) from exc
