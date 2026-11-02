
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict


class IncidentType(str, Enum):
    MEDICAL = "medical"
    ROAD_ACCIDENT = "road_accident"
    FIRE = "fire"
    PERSONAL_SAFETY = "personal_safety"
    NATURAL_DISASTER = "natural_disaster"
    CRIME = "crime"
    LOST_PERSON = "lost_person"
    OTHER = "other"


class IncidentSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IncidentLocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    address: str | None = None


class IncidentContext(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True
    )

    incident_id: str | None = None

    incident_type: IncidentType

    severity: IncidentSeverity

    description: str = Field(
        min_length=5,
        max_length=2000
    )

    location: IncidentLocation | None = None

    people_affected: int = Field(
        default=1,
        ge=1,
        le=1000
    )

    additional_information: dict[str, str] = Field(
        default_factory=dict
    )
