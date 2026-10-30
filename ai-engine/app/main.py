
from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.gemini import router as gemini_router

app = FastAPI(
    title="Sentinel AI Engine",
    description="AI, RAG and Context Intelligence Service for Sentinel 2.0",
    version="1.0.0"
)

app.include_router(health_router, prefix="/api/v1")
app.include_router(gemini_router, prefix="/api/v1/ai")


@app.get("/")
async def root():
    return {
        "message": "Welcome to Sentinel AI Engine",
        "version": "1.0.0"
    }
