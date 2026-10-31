from app.rag.embeddings import generate_embedding
from app.rag.vector_store import search_documents, close_vector_store


def retrieve_relevant_documents(query: str, limit: int = 5) -> list[dict]:
    """Retrieve relevant knowledge chunks for an emergency query."""

    if not query.strip():
        raise ValueError("Search query cannot be empty.")

    try:
        query_embedding = generate_embedding(query)

        results = search_documents(
            query_embedding=query_embedding,
            limit=limit
        )

        return [
            {
                "content": point.payload["content"],
                "source": point.payload["source"],
                "score": point.score
            }
            for point in results
            if point.payload
        ]

    finally:
        close_vector_store()