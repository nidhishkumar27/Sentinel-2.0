
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


from pydantic import BaseModel, Field

from app.schemas.incident import IncidentContext


class EmergencyAnalysisRequest(BaseModel):
    incident: IncidentContext

    user_query: str = Field(
        default="Analyze this emergency and provide appropriate guidance.",
        min_length=5,
        max_length=2000
    )


class EmergencyAnalysisResponse(BaseModel):
    status: str
    incident_id: str | None = None

    incident_type: str
    severity: str

    emergency_summary: str
    immediate_actions: list[str]

    missing_information: list[str] = Field(
        default_factory=list
    )

    sources: list[dict] = Field(
        default_factory=list
    )

    disclaimer: str
