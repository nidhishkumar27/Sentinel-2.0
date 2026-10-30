
from google import genai
from app.core.config import settings


client = genai.Client(api_key=settings.GEMINI_API_KEY)


def generate_ai_response(prompt: str) -> str:
    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt
    )

    if not response.text:
        raise RuntimeError("Gemini returned an empty response")

    return response.text
