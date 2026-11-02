
from app.rag.embeddings import generate_embedding
from app.rag.vector_store import search_documents


INCIDENT_DOCUMENTS = {
    "medical": ["medical_emergency.md", "emergency_first_aid.md"],
    "road_accident": ["road_accident.md", "emergency_first_aid.md", "medical_emergency.md"],
    "fire": ["fire_safety.md", "emergency_first_aid.md"],
    "personal_safety": ["personal_safety.md", "emergency_first_aid.md"],
    "natural_disaster": ["flood_emergency.md", "emergency_first_aid.md"],
    "lost_person": ["lost_person.md", "personal_safety.md", "emergency_first_aid.md"],
    "other": ["emergency_first_aid.md"],
}


def retrieve_relevant_documents(
    query: str,
    limit: int = 5,
    min_score: float = 0.30,
    incident_type: str | None = None
) -> list[dict]:
    """Retrieve relevant knowledge with incident-aware prioritization."""

    if not query.strip():
        raise ValueError("Search query cannot be empty.")

    query_embedding = generate_embedding(query)

    # Fetch more candidates before applying the relevance threshold.
    results = search_documents(
        query_embedding=query_embedding,
        limit=20
    )

    allowed_sources = INCIDENT_DOCUMENTS.get(
        incident_type,
        None
    )

    documents = []

    for point in results:
        if not point.payload:
            continue

        source = point.payload.get("source")
        content = point.payload.get("content")

        if not source or not content:
            continue

        if point.score < min_score:
            continue

        if allowed_sources and source not in allowed_sources:
            continue

        documents.append({
            "content": content,
            "source": source,
            "score": point.score
        })

    # Rank by similarity while preserving the incident-specific scope.
    documents.sort(key=lambda doc: doc["score"], reverse=True)

    return documents[:limit]
