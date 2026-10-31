from app.rag.rag_service import generate_rag_response


incident = {
    "incident_type": "Road Accident",
    "severity": "High",
    "location": "Bengaluru",
    "description": "A person has sustained severe bleeding after a road accident.",
    "people_affected": 1
}

query = "What immediate first aid should be provided to the injured person?"

print("\nStarting Sentinel RAG + Gemini test...\n")

result = generate_rag_response(
    query=query,
    incident_context=incident
)

print("STATUS:", result["status"])
print("\nAI RESPONSE:\n")
print(result["response"])

print("\nRETRIEVED SOURCES:\n")

for source in result["sources"]:
    print("Source:", source["source"])
    print("Relevance:", round(source["relevance_score"], 4))
    print()