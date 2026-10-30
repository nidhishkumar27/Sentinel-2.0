
import logging

from fastapi import APIRouter, HTTPException

from app.schemas.ai import AIRequest, AIResponse
from app.services.gemini_service import generate_ai_response
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/generate", response_model=AIResponse)
def generate_response(request: AIRequest):
    try:
        result = generate_ai_response(request.prompt)

        return AIResponse(
            status="success",
            response=result,
            model=settings.GEMINI_MODEL
        )

    except Exception as exc:
        logger.exception("Gemini API request failed")

        raise HTTPException(
            status_code=502,
            detail="Gemini generation failed. Check the AI service terminal logs."
        ) from exc
