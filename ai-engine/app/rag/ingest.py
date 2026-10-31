from pathlib import Path

from app.rag.document_loader import load_documents, chunk_text
from app.rag.embeddings import generate_embeddings
from app.rag.vector_store import (
    recreate_collection,
    store_documents,
    close_vector_store
)

BASE_DIR = Path(__file__).resolve().parents[2]
DOCUMENTS_DIR = BASE_DIR / "data" / "documents"


def ingest_documents():
    """Load, chunk, embed and store knowledge documents."""

    print("Starting Sentinel RAG ingestion...")

    try:
        documents = load_documents(str(DOCUMENTS_DIR))

        if not documents:
            print("No documents found.")
            return

        all_chunks = []

        for document in documents:
            chunks = chunk_text(document["content"])

            for chunk in chunks:
                all_chunks.append({
                    "content": chunk,
                    "source": document["source"]
                })

        print(f"Documents loaded: {len(documents)}")
        print(f"Chunks created: {len(all_chunks)}")

        embeddings = generate_embeddings([
            chunk["content"] for chunk in all_chunks
        ])

        for chunk, embedding in zip(all_chunks, embeddings):
            chunk["embedding"] = embedding

        recreate_collection()
        store_documents(all_chunks)

        print(f"Successfully stored {len(all_chunks)} chunks in Qdrant.")

    finally:
        close_vector_store()


if __name__ == "__main__":
    ingest_documents()