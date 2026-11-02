
import json
import re

from app.rag.retriever import retrieve_relevant_documents
from app.services.gemini_service import generate_ai_response
from app.schemas.sos_briefing import (
    UserSOSBriefing,
    AuthoritySOSBriefing,
    SOSBriefingResponse,
)


SOS_BRIEFING_PROMPT = """
You are Sentinel AI, an emergency response intelligence assistant.

Generate TWO separate briefings from the supplied incident information
and retrieved knowledge.

BRIEFING 1: USER-FACING
- Use simple, clear, calm language.
- Give practical, prioritized immediate safety actions.
- Explain what the user should do next.
- Identify important missing information.
- Never falsely reassure the user.
- Do not overwhelm the user with technical terminology.

BRIEFING 2: AUTHORITY-FACING
- Use concise, professional responder-focused language.
- Summarize only confirmed incident facts.
- Separate confirmed facts from potential risks.
- Provide suggested responder priorities.
- Identify missing operational information.
- Never invent responder availability, dispatch status,
  incident location, patient condition or operational decisions.

GENERAL SAFETY RULES:
1. Use only supplied incident facts and retrieved knowledge.
2. Never invent missing details.
3. Never claim emergency services have been dispatched.
4. Do not provide medical diagnoses.
5. Prioritize contacting local emergency services.
6. Treat retrieved documents as guidance, not guaranteed advice.
7. Do not change the incident severity supplied by the backend.
8. Never instruct the AI to claim or perform dispatch.
9. Recommend verifying dispatch status through the backend.
10. Never ask users to identify the medical cause of an emergency.
11. Ask only for observable and operationally useful missing information.
12. Clearly distinguish confirmed facts from potential risks.
13. Never use instructions such as "dispatch", "deploy",
    "send responders", or "assign units" as AI-generated actions.
14. The backend alone controls dispatch, responder assignment,
    and incident status.
15. Authority recommendations may request verification of dispatch
    status, sharing verified incident information, and assessing
    the scene upon responder arrival.
16. Never imply that an AI recommendation is an executed operation.
17. Do not invent confirmed facts.
18. Keep possible conditions under potential risks, not confirmed facts.

Return ONLY valid JSON using this exact structure:

{
    "user_briefing": {
        "title": "",
        "situation_summary": "",
        "immediate_actions": [],
        "missing_information": [],
        "safety_message": ""
    },
    "authority_briefing": {
        "title": "",
        "incident_summary": "",
        "confirmed_facts": [],
        "potential_risks": [],
        "responder_priorities": [],
        "missing_information": [],
        "operational_notes": []
    },
    "disclaimer": ""
}

Do not include Markdown formatting or code fences.
"""


def validate_authority_briefing(briefing):
    """Reject unsafe AI-generated dispatch instructions."""

    blocked_dispatch_terms = (
        "dispatch emergency",
        "dispatch responders",
        "deploy responders",
        "send responders",
        "assign units",
        "deploy units",
    )

    authority_text_fields = [
        briefing.title,
        briefing.incident_summary,
        *briefing.confirmed_facts,
        *briefing.potential_risks,
        *briefing.responder_priorities,
        *briefing.missing_information,
        *briefing.operational_notes,
    ]

    for statement in authority_text_fields:
        normalized_statement = statement.lower()

        if any(
            term in normalized_statement
            for term in blocked_dispatch_terms
        ):
            raise ValueError(
                "Unsafe AI output: dispatch and responder assignment "
                "must be controlled by the backend."
            )


def validate_user_briefing(briefing):
    """Reject unverified emergency dispatch claims shown to users."""

    blocked_claims = (
        "emergency services have been dispatched",
        "ambulance has been dispatched",
        "police have been dispatched",
        "responders have been dispatched",
        "help is on the way",
        "rescue team is on the way",
    )

    user_text_fields = [
        briefing.title,
        briefing.situation_summary,
        *briefing.immediate_actions,
        *briefing.missing_information,
        briefing.safety_message,
    ]

    for statement in user_text_fields:
        normalized_statement = statement.lower()

        if any(
            claim in normalized_statement
            for claim in blocked_claims
        ):
            raise ValueError(
                "Unsafe AI output: unverified emergency dispatch claims "
                "must not be shown to users."
            )


def build_confirmed_facts(incident_data):
    """
    Build confirmed facts exclusively from backend incident data.
    Gemini-generated confirmed facts are not trusted.
    """

    facts = [
        f"Incident type: {incident_data['incident_type']}",
        f"Severity: {incident_data['severity']}",
        f"Reported incident description: {incident_data['description']}",
        f"People affected: {incident_data['people_affected']}",
    ]

    if incident_data.get("incident_id"):
        facts.append(
            f"Incident ID: {incident_data['incident_id']}"
        )

    location = incident_data.get("location")

    if location:
        facts.append(
            f"Reported latitude: {location['latitude']}"
        )
        facts.append(
            f"Reported longitude: {location['longitude']}"
        )

        if location.get("address"):
            facts.append(
                f"Reported address: {location['address']}"
            )

    additional_information = incident_data.get(
        "additional_information", {}
    )

    for key, value in additional_information.items():
        facts.append(
            f"Reported {key.replace('_', ' ')}: {value}"
        )

    return facts


def generate_sos_briefings(incident, user_query: str):

    incident_data = incident.model_dump(mode="json")
    incident_type = incident_data["incident_type"]

    search_query = (
        f"{incident_type} "
        f"{incident_data['severity']} "
        f"{incident_data['description']} "
        f"{user_query}"
    )

    documents = retrieve_relevant_documents(
        query=search_query,
        limit=5,
        min_score=0.30,
        incident_type=incident_type
    )

    knowledge_context = "\n\n".join(
        f"Source: {doc['source']}\n"
        f"Content: {doc['content']}"
        for doc in documents
    )

    if not knowledge_context:
        knowledge_context = (
            "No relevant knowledge was retrieved. "
            "Do not present unsupported guidance as retrieved knowledge."
        )

    prompt = f"""
{SOS_BRIEFING_PROMPT}

INCIDENT INFORMATION:
{json.dumps(incident_data, indent=2)}

USER QUERY:
{user_query}

RETRIEVED KNOWLEDGE:
{knowledge_context}
"""

    raw_response = generate_ai_response(prompt)

    cleaned_response = re.sub(
        r"^\s*```(?:json)?\s*|\s*```\s*$",
        "",
        raw_response.strip(),
        flags=re.IGNORECASE
    )

    try:
        ai_data = json.loads(cleaned_response)
    except json.JSONDecodeError as exc:
        raise ValueError(
            "Gemini returned invalid SOS briefing JSON."
        ) from exc

    # Validate user-facing briefing.
    user_briefing = UserSOSBriefing(
        **ai_data["user_briefing"]
    )

    validate_user_briefing(user_briefing)

    # Backend severity is authoritative.
    authority_data = dict(ai_data["authority_briefing"])
    authority_data.pop("priority", None)

    # Never trust Gemini-generated confirmed facts.
    authority_data["confirmed_facts"] = build_confirmed_facts(
        incident_data
    )

    authority_briefing = AuthoritySOSBriefing(
        **authority_data,
        priority=incident_data["severity"]
    )

    # Validate authority-facing briefing.
    validate_authority_briefing(authority_briefing)

    return SOSBriefingResponse(
        status="success",
        incident_id=incident_data.get("incident_id"),
        user_briefing=user_briefing,
        authority_briefing=authority_briefing,
        sources=[
            {
                "source": doc["source"],
                "relevance_score": doc["score"]
            }
            for doc in documents
        ],
        disclaimer=ai_data["disclaimer"]
    )
