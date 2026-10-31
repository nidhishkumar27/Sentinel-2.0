import logging
import time

from google import genai
from google.genai import errors

from app.core.config import settings


logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.GEMINI_API_KEY)


def generate_ai_response(prompt: str) -> str:
    """Generate an AI response with retries for temporary failures."""

    max_attempts = 3

    for attempt in range(max_attempts):
        try:
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt
            )

            if not response.text:
                raise RuntimeError("Gemini returned an empty response.")

            return response.text

        except (errors.ServerError, errors.APIError) as exc:
            status_code = getattr(exc, "code", None)

            if status_code not in (429, 500, 502, 503, 504):
                raise

            if attempt == max_attempts - 1:
                logger.exception("Gemini remained unavailable after retries.")
                raise

            delay = 2 ** attempt
            logger.warning(
                "Gemini temporarily unavailable. Retrying in %s seconds.",
                delay
            )
            time.sleep(delay)

    raise RuntimeError("Gemini generation failed.")