import os
import asyncio
import time
from typing import Optional

# In-memory store: job_id → { queue, preview, zip_path }
_jobs: dict = {}
_timestamps: dict[str, float] = {}

JOB_TTL = int(os.getenv("JOB_TTL_SECONDS", 3600))  # evict after 1 hour


def create_job(job_id: str):
    _evict_old_jobs()
    _jobs[job_id] = {
        "queue":    asyncio.Queue(),
        "preview":  None,
        "zip_path": None,
    }
    _timestamps[job_id] = time.time()


def _evict_old_jobs():
    cutoff = time.time() - JOB_TTL
    stale = [jid for jid, ts in list(_timestamps.items()) if ts < cutoff]
    for jid in stale:
        job = _jobs.pop(jid, {})
        _timestamps.pop(jid, None)
        # Delete the ZIP file from disk
        zip_path = job.get("zip_path")
        if zip_path and os.path.exists(zip_path):
            try:
                os.unlink(zip_path)
            except Exception:
                pass


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