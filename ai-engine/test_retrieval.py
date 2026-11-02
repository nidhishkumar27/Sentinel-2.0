
from app.rag.retriever import retrieve_relevant_documents
from app.rag.vector_store import close_vector_store

scenarios = {
    "Medical Emergency": (
        "medical",
        "A person has collapsed, is unconscious, and may not be breathing normally."
    ),
    "Road Accident": (
        "road_accident",
        "A motorcyclist is injured in a road accident with severe bleeding."
    ),
    "Fire Emergency": (
        "fire",
        "A residential building is on fire, with smoke spreading and people inside."
    ),
    "Personal Safety": (
        "personal_safety",
        "A person is being followed by an unknown individual on a public street at night."
    ),
    "Natural Disaster": (
        "natural_disaster",
        "Flooding has left several people stranded in a residential area."
    ),
    "Lost Person": (
        "lost_person",
        "A tourist is lost in an unfamiliar city and has only 15 percent phone battery."
    ),
}

try:
    for name, (incident_type, query) in scenarios.items():
        print("\n" + "=" * 65)
        print(f"SCENARIO: {name}")
        print("=" * 65)

        results = retrieve_relevant_documents(
            query=query,
            limit=5,
            min_score=0.30,
            incident_type=incident_type
        )

        if not results:
            print("No relevant documents retrieved.")
            continue

        for index, result in enumerate(results, start=1):
            print(f"\n{index}. Source: {result['source']}")
            print(f"   Score: {result['score']:.4f}")
            print(f"   Content: {result['content'][:250]}")

finally:
    close_vector_store()
