from fastapi import APIRouter, HTTPException
from core.job_store import get_preview_data

router = APIRouter()


@router.get("/preview/{job_id}")
async def get_preview(job_id: str):
    data = get_preview_data(job_id)
    if not data:
        raise HTTPException(status_code=404, detail="Preview not ready yet")
    return data