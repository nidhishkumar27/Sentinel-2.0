
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.incident import IncidentContext


class SOSBriefingRequest(BaseModel):
    incident: IncidentContext

    user_query: str = Field(
        default="Generate user-facing and authority-facing SOS briefings.",
        max_length=2000
    )


class UserSOSBriefing(BaseModel):
    title: str

    situation_summary: str

    immediate_actions: list[str] = Field(
        min_length=1
    )

    missing_information: list[str] = Field(
        default_factory=list
    )

    safety_message: str


class AuthoritySOSBriefing(BaseModel):
    title: str

    incident_summary: str

    priority: Literal["low", "medium", "high", "critical"]

    confirmed_facts: list[str] = Field(
        default_factory=list
    )

    potential_risks: list[str] = Field(
        default_factory=list
    )

    responder_priorities: list[str] = Field(
        min_length=1
    )

    missing_information: list[str] = Field(
        default_factory=list
    )

    operational_notes: list[str] = Field(
        default_factory=list
    )


class SOSBriefingSource(BaseModel):
    source: str
    relevance_score: float


class SOSBriefingResponse(BaseModel):
    status: Literal["success"]

    incident_id: str | None = None

    user_briefing: UserSOSBriefing

    authority_briefing: AuthoritySOSBriefing

    sources: list[SOSBriefingSource] = Field(
        default_factory=list
    )

    disclaimer: str
