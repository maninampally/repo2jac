import json
import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from core.job_store import get_event_queue

router = APIRouter()


@router.get("/stream/{job_id}")
async def stream_progress(job_id: str):
    async def event_generator():

        # BUG-3 FIX: wait up to 5 seconds for job to be registered
        # prevents false "Job not found" when SSE opens before pipeline starts
        queue = None
        for _ in range(50):
            queue = get_event_queue(job_id)
            if queue:
                break
            await asyncio.sleep(0.1)

        if queue is None:
            yield f"event: error\ndata: {json.dumps({'message': 'Job not found'})}\n\n"
            return

        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=60.0)
                yield f"event: {event['type']}\ndata: {json.dumps(event['data'])}\n\n"
                if event["type"] in ("complete", "error"):
                    break
            except asyncio.TimeoutError:
                yield ": ping\n\n"  # keepalive

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )