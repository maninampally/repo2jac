import uuid
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from core.job_store import create_job
from core.pipeline import run_pipeline

router = APIRouter()


class ConvertRequest(BaseModel):
    github_url: str
    include_tests: bool = False
    target_model: str = "claude-3-5-sonnet-20241022"


class ConvertResponse(BaseModel):
    job_id: str
    status: str
    stream_url: str


@router.post("/convert", response_model=ConvertResponse)
async def start_conversion(req: ConvertRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())

    # BUG-2 FIX: create job BEFORE returning response
    # so the queue exists when the frontend opens the SSE stream
    create_job(job_id)

    # BUG-2 FIX: use BackgroundTasks instead of asyncio.create_task
    background_tasks.add_task(
        run_pipeline, job_id, req.github_url, req.target_model
    )

    return ConvertResponse(
        job_id=job_id,
        status="started",
        stream_url=f"/api/stream/{job_id}"   # BUG-4 FIX: correct prefix
    )