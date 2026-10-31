from app.rag.retriever import retrieve_relevant_documents
from app.services.gemini_service import generate_ai_response


SYSTEM_INSTRUCTIONS = """
You are Sentinel AI, an emergency response intelligence assistant.

Your responsibility is to provide clear, safe and context-aware guidance.

STRICT RULES:
1. Use the provided incident information and retrieved knowledge.
2. Never invent incident details, medical facts or user information.
3. Never claim that an ambulance has been dispatched or emergency
   services have been contacted unless explicitly confirmed by the backend.
4. Never claim to access GPS, monitor a person or perform external actions.
5. If information is missing, clearly state the uncertainty.
6. Prioritize immediate safety and contacting local emergency services.
7. For medical emergencies, provide concise first-aid guidance and
   encourage following instructions from trained emergency responders.
8. Do not treat retrieved documents as guaranteed medical advice.
9. If retrieved information is insufficient, say so instead of guessing.

Keep your response structured and easy to understand.
"""


def generate_rag_response(
    query: str,
    incident_context: dict | None = None,
    limit: int = 3
) -> dict:
    """Generate a context-aware response using RAG and Gemini."""

    if not query.strip():
        raise ValueError("Emergency query cannot be empty.")

    # Step 1: Retrieve relevant knowledge
    retrieved_documents = retrieve_relevant_documents(
        query=query,
        limit=limit
    )

    # Step 2: Prepare retrieved context
    knowledge_context = "\n\n".join(
        [
            f"Source: {document['source']}\n"
            f"Content: {document['content']}"
            for document in retrieved_documents
        ]
    )

    if not knowledge_context:
        knowledge_context = "No relevant knowledge documents were retrieved."

    # Step 3: Prepare incident context
    incident_context = incident_context or {}

    # Step 4: Construct grounded prompt
    prompt = f"""
{SYSTEM_INSTRUCTIONS}

INCIDENT INFORMATION:
{incident_context}

USER EMERGENCY QUERY:
{query}

RETRIEVED KNOWLEDGE:
{knowledge_context}

TASK:
Provide a response based only on the supplied incident facts
and relevant retrieved knowledge.

Clearly distinguish confirmed facts from missing information.
Give immediate safety guidance and appropriate next steps.
Do not claim that any external action has been performed.
"""

    # Step 5: Generate Gemini response
    ai_response = generate_ai_response(prompt)

    # Step 6: Return response and source information
    return {
        "status": "success",
        "query": query,
        "response": ai_response,
        "sources": [
            {
                "source": document["source"],
                "relevance_score": document["score"]
            }
            for document in retrieved_documents
        ]
    }