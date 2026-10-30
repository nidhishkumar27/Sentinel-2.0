
from pydantic import BaseModel, Field


class AIRequest(BaseModel):
    prompt: str = Field(
        min_length=1,
        max_length=5000,
        description="Prompt to send to Gemini"
    )


class AIResponse(BaseModel):
    status: str
    response: str
    model: str
