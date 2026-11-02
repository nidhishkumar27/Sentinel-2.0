
import json
import re

from app.schemas.ai import EmergencyAnalysisResponse
from app.rag.retriever import retrieve_relevant_documents
from app.services.gemini_service import generate_ai_response


SYSTEM_PROMPT = """
You are Sentinel AI, an emergency response intelligence assistant.

Analyze the supplied emergency information and retrieved knowledge.

RULES:
1. Use only the supplied incident facts and retrieved knowledge.
2. Never invent missing incident details.
3. Never claim an ambulance or emergency service has been dispatched.
4. Give clear, practical and prioritized immediate safety actions.
5. If information is missing, identify it explicitly.
6. Do not provide medical diagnoses.
7. Prioritize contacting local emergency services.
8. Treat retrieved documents as guidance, not guaranteed medical advice.

Return ONLY valid JSON with this structure:

{
    "emergency_summary": "A concise summary of the situation",
    "immediate_actions": [
        "First action",
        "Second action"
    ],
    "missing_information": [
        "Information that is not available"
    ],
    "disclaimer": "A brief emergency safety disclaimer"
}

Do not include Markdown formatting or code fences.
"""


def analyze_emergency(incident, user_query: str):

    incident_data = incident.model_dump(mode="json")

    search_query = (
        f"{incident_data['incident_type']} "
        f"{incident_data['severity']} "
        f"{incident_data['description']} "
        f"{user_query}"
    )

    documents = retrieve_relevant_documents(
    query=search_query,
    limit=5,
    incident_type=incident_data["incident_type"]
)

    knowledge_context = "\n\n".join(
        f"Source: {doc['source']}\n"
        f"Content: {doc['content']}"
        for doc in documents
    )

    if not knowledge_context:
        knowledge_context = "No relevant knowledge was retrieved."

    prompt = f"""
{SYSTEM_PROMPT}

INCIDENT INFORMATION:
{json.dumps(incident_data, indent=2)}

USER QUERY:
{user_query}

RETRIEVED KNOWLEDGE:
{knowledge_context}
"""

    raw_response = generate_ai_response(prompt)

    # Remove Markdown code fences if Gemini returns them.
    cleaned_response = re.sub(
        r"^```(?:json)?\s*|\s*```$",
        "",
        raw_response.strip(),
        flags=re.IGNORECASE
    )

    try:
        ai_data = json.loads(cleaned_response)
    except json.JSONDecodeError as exc:
        raise ValueError(
            "Gemini returned an invalid JSON response."
        ) from exc

    response = EmergencyAnalysisResponse(
        status="success",
        incident_id=incident_data.get("incident_id"),
        incident_type=incident_data["incident_type"],
        severity=incident_data["severity"],
        emergency_summary=ai_data["emergency_summary"],
        immediate_actions=ai_data["immediate_actions"],
        missing_information=ai_data.get(
            "missing_information", []
        ),
        sources=[
            {
                "source": doc["source"],
                "relevance_score": doc["score"]
            }
            for doc in documents
        ],
        disclaimer=ai_data["disclaimer"]
    )

    return response
