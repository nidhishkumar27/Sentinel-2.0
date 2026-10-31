from app.rag.retriever import retrieve_relevant_documents

query = "A person has severe bleeding after a road accident. What first aid should be provided?"

results = retrieve_relevant_documents(query)

print("\nRetrieved Documents:", len(results))

for result in results:
    print("\nSource:", result["source"])
    print("Score:", round(result["score"], 4))
    print("Content:", result["content"])