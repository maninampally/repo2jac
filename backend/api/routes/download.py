from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from core.job_store import get_output_path

router = APIRouter()


@router.get("/download/{job_id}")
async def download_zip(job_id: str):
    path = get_output_path(job_id)
    if not path:
        raise HTTPException(status_code=404, detail="Output not ready yet")
    return FileResponse(
        path,
        media_type="application/zip",
        filename="converted-jac.zip"
    )