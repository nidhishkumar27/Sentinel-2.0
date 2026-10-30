
from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Sentinel AI Engine",
        "message": "AI service is running successfully"
    }
