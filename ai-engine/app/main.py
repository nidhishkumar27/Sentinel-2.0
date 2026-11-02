
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.emergency import router as emergency_router
from app.api.health import router as health_router
from app.api.gemini import router as gemini_router
from app.rag.vector_store import close_vector_store
from app.api.sos_briefing import router as sos_briefing_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage resources during application startup and shutdown."""

    print("Sentinel AI Engine starting...")

    yield

    print("Closing Qdrant connection...")
    close_vector_store()

    print("Sentinel AI Engine shut down.")


app = FastAPI(
    title="Sentinel AI Engine",
    description="AI, RAG and Context Intelligence Service for Sentinel 2.0",
    version="1.0.0",
    lifespan=lifespan
)


app.include_router(health_router, prefix="/api/v1")
app.include_router(gemini_router, prefix="/api/v1/ai")
app.include_router(emergency_router, prefix="/api/v1/ai")
app.include_router(
    sos_briefing_router,
    prefix="/api/v1/ai",
    tags=["SOS Briefing"]
)


@app.get("/")
async def root():
    return {
        "message": "Welcome to Sentinel AI Engine",
        "version": "1.0.0"
    }
