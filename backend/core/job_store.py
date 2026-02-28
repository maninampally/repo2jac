import asyncio
from typing import Optional

# In-memory store: job_id → { queue, preview, zip_path }
_jobs: dict = {}


def create_job(job_id: str):
    _jobs[job_id] = {
        "queue":    asyncio.Queue(),
        "preview":  None,
        "zip_path": None,
    }


def get_event_queue(job_id: str) -> Optional[asyncio.Queue]:
    return _jobs.get(job_id, {}).get("queue")


def push_event(job_id: str, event_type: str, data: dict):
    q = get_event_queue(job_id)
    if q:
        q.put_nowait({"type": event_type, "data": data})


def set_preview(job_id: str, data: dict):
    if job_id in _jobs:
        _jobs[job_id]["preview"] = data


def get_preview_data(job_id: str) -> Optional[dict]:
    return _jobs.get(job_id, {}).get("preview")


def set_output_path(job_id: str, path: str):
    if job_id in _jobs:
        _jobs[job_id]["zip_path"] = path


def get_output_path(job_id: str) -> Optional[str]:
    return _jobs.get(job_id, {}).get("zip_path")