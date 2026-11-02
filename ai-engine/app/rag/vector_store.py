
import hashlib
from pathlib import Path

from qdrant_client import QdrantClient, models


BASE_DIR = Path(__file__).resolve().parents[2]
QDRANT_PATH = BASE_DIR / "data" / "qdrant"

COLLECTION_NAME = "sentinel_knowledge"
VECTOR_SIZE = 384

# Create one persistent Qdrant client.
client = QdrantClient(path=str(QDRANT_PATH))


def create_collection():
    """Create the knowledge collection if it doesn't exist."""

    if not client.collection_exists(COLLECTION_NAME):
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(
                size=VECTOR_SIZE,
                distance=models.Distance.COSINE
            )
        )


def recreate_collection():
    """Delete the existing collection and create a fresh one."""

    if client.collection_exists(COLLECTION_NAME):
        client.delete_collection(COLLECTION_NAME)

    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=models.VectorParams(
            size=VECTOR_SIZE,
            distance=models.Distance.COSINE
        )
    )

    print("Qdrant collection recreated successfully.")


def store_documents(chunks: list[dict]):
    """Store chunks using deterministic IDs."""

    if not chunks:
        return

    points = []

    for chunk in chunks:
        unique_text = f"{chunk['source']}:{chunk['content']}"

        point_id = hashlib.md5(
            unique_text.encode("utf-8")
        ).hexdigest()

        points.append(
            models.PointStruct(
                id=point_id,
                vector=chunk["embedding"],
                payload={
                    "content": chunk["content"],
                    "source": chunk["source"]
                }
            )
        )

    client.upsert(
        collection_name=COLLECTION_NAME,
        points=points
    )


def search_documents(query_embedding: list[float], limit: int = 5):
    """Retrieve relevant document chunks."""

    results = client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_embedding,
        limit=limit,
        with_payload=True
    )

    return results.points


def close_vector_store():
    """Close the Qdrant connection when the application shuts down."""

    client.close()
