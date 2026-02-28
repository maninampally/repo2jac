# Repo-to-Jac — Bugs, Missing Code & Fix Reference

> Generated: 2026-02-27  
> Covers every file in `backend/` and `frontend/` as they exist right now.

---

## Severity Legend

| Symbol | Meaning |
|--------|---------|
| 🔴 CRITICAL | App breaks or crashes for all users |
| 🟠 HIGH | Feature is broken in common scenarios |
| 🟡 MEDIUM | Bug in edge cases or under load |
| 🟢 LOW | Code quality / future maintenance risk |

---

## 🔴 CRITICAL — Must Fix Before Real Use

---

### BUG-1 · `backend/core/pipeline.py` — Sync LLM blocks the entire event loop

**File:** `backend/core/pipeline.py`  
**Function:** `llm()` called from `async def run_pipeline()`

**Problem:**  
The `llm()` function uses the **synchronous** Anthropic SDK (`client.messages.create()`). Every
LLM call (there are 4–6 per conversion, each takes 5–30 seconds) **completely blocks the asyncio
event loop** while it waits for the HTTP response. During that time:

- SSE keepalive pings cannot be sent → browser times out and closes the stream
- All other HTTP requests (health checks, other users) are stalled
- The frontend receives no SSE events → interprets silence as failure

**Current code (broken):**
```python
# pipeline.py line ~42
def llm(prompt: str, temperature: float = 0.2, max_tokens: int = 4096) -> str:
    resp = _get_client().messages.create(...)   # ← BLOCKS event loop
    return resp.content[0].text.strip()

# called as:
role = llm(classify_role_prompt(...))   # ← sync call inside async func
```

**Fix — wrap in thread executor:**
```python
import asyncio

def _llm_sync(prompt: str, temperature: float, max_tokens: int) -> str:
    """Synchronous Anthropic call — always run via run_in_executor."""
    resp = _get_client().messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
    )
    return resp.content[0].text.strip()

async def llm(prompt: str, temperature: float = 0.2, max_tokens: int = 4096) -> str:
    """Async wrapper — runs sync call in thread pool, never blocks event loop."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, _llm_sync, prompt, temperature, max_tokens
    )
```

Then change every `llm(...)` call in `run_pipeline` to `await llm(...)`:
```python
role     = await llm(classify_role_prompt(...))
plan_raw = await llm(generate_plan_prompt(...))
jac_code = await llm(generate_jac_code_prompt(...))
readme   = await llm(generate_readme_prompt(...))
demo     = await llm(generate_demo_prompt(...))
```

---

### BUG-2 · `backend/api/routes/convert.py` — `asyncio.create_task()` race condition

**File:** `backend/api/routes/convert.py`  
**Function:** `start_conversion()`

**Problem:**  
`asyncio.create_task(run_pipeline(...))` schedules the task for the **next event loop iteration**.
The response (`job_id`) is returned immediately, and the frontend instantly opens an SSE
connection to `/api/stream/{job_id}`. At that point `run_pipeline` hasn't run yet, so
`create_job()` hasn't been called, so the queue doesn't exist yet.  

`stream.py` calls `get_event_queue(job_id)` → gets `None` → immediately sends
`event: error` → stream closes before the pipeline even starts.

**Current code (broken):**
```python
@router.post("/convert", response_model=ConvertResponse)
async def start_conversion(req: ConvertRequest):
    job_id = str(uuid.uuid4())
    asyncio.create_task(                          # ← task may not run before stream opens
        run_pipeline(job_id, req.github_url, req.target_model)
    )
    return ConvertResponse(job_id=job_id, status="started", stream_url=f"/stream/{job_id}")
```

**Fix — use FastAPI `BackgroundTasks` (more reliable) AND pre-create the job:**
```python
from fastapi import APIRouter, BackgroundTasks
from core.job_store import create_job          # ← import create_job here

@router.post("/convert", response_model=ConvertResponse)
async def start_conversion(req: ConvertRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    create_job(job_id)                          # ← create queue BEFORE returning
    background_tasks.add_task(
        run_pipeline, job_id, req.github_url, req.target_model
    )
    return ConvertResponse(
        job_id=job_id,
        status="started",
        stream_url=f"/api/stream/{job_id}"      # ← fix URL prefix too (see BUG-4)
    )
```

Also remove the `create_job(job_id)` call from the top of `run_pipeline()` in `pipeline.py`,
since it now happens in the route handler.

---

### BUG-3 · `backend/api/routes/stream.py` — No wait loop for job creation

**File:** `backend/api/routes/stream.py`  
**Function:** `stream_progress()`

**Problem:**  
Even after fixing BUG-2, there's still a window where the stream handler runs before
`create_job()` is complete (network/thread scheduling). The current code does:
```python
queue = get_event_queue(job_id)
if not queue:
    yield f"event: error\ndata: ..."
    return                          # ← gives up immediately
```

This causes a false "Job not found" error if the SSE connection arrives slightly early.

**Fix — add a short polling loop:**
```python
@router.get("/stream/{job_id}")
async def stream_progress(job_id: str):
    async def event_generator():
        # Wait up to 5 seconds for the job to be registered
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
                yield ": ping\n\n"   # keepalive

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
```

---

## 🟠 HIGH — Broken in Common Scenarios

---

### BUG-4 · `backend/api/routes/convert.py` — Wrong `stream_url` in response

**File:** `backend/api/routes/convert.py`

**Problem:**  
The response includes `stream_url: "/stream/{job_id}"`. The frontend ignores this field and
hardcodes `/api/stream/${jobId}`, so functionally it's still OK — but the response is misleading
and creates a maintenance trap.

**Fix:**
```python
stream_url=f"/api/stream/{job_id}"
```

---

### BUG-5 · `frontend/Dockerfile` — Running dev server in all environments

**File:** `frontend/Dockerfile`

**Problem:**  
The Dockerfile runs `npm run dev` which:
- Compiles every page on first request (slow cold starts in Docker)
- Has no optimized build output
- Does not produce a production-ready image

**Current:**
```dockerfile
CMD ["npm", "run", "dev"]
```

**Fix — add a production-mode option or at minimum document the limitation:**

For production, use a multi-stage build:
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL=http://backend:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["npm", "start"]
```

For the `npm start` approach to work, add to `next.config.js`:
```js
const nextConfig = {
  output: "standalone",   // slim production image support
  // ...existing rewrites
};
```

---

### BUG-6 · `frontend/package.json` — `next` version still at `14.2.3`

**File:** `frontend/package.json`

**Problem:**  
`next: "14.2.3"` contains a **critical authorization bypass** (GHSA-qpjv-v59x-3qcm) and 13
other CVEs. Should be `14.2.35` which patches all of them.

**Current:**
```json
"next": "14.2.3",
"eslint-config-next": "14.2.3"
```

**Fix:**
```json
"next": "14.2.35",
"eslint-config-next": "14.2.35"
```

Then re-run `npm install`.

---

### BUG-7 · `backend/utils/syntax_validator.py` — `tmp_path` may be undefined in `finally`

**File:** `backend/utils/syntax_validator.py`

**Problem:**  
`tmp_path` is assigned inside the `with NamedTemporaryFile(...)` block. If that `with` statement
itself raises (e.g. disk full, permissions error), `tmp_path` is never assigned. The `finally`
block then raises `NameError: name 'tmp_path' is not defined`, masking the real error.

**Current:**
```python
def validate_jac_syntax(jac_code: str) -> tuple[bool, str]:
    with tempfile.NamedTemporaryFile(...) as f:
        f.write(jac_code)
        tmp_path = f.name      # ← defined inside with block
    try:
        ...
    finally:
        try:
            os.unlink(tmp_path)   # ← NameError if with block failed
```

**Fix — initialize `tmp_path = None` before the `with` block:**
```python
def validate_jac_syntax(jac_code: str) -> tuple[bool, str]:
    tmp_path = None                                  # ← initialize first
    try:
        with tempfile.NamedTemporaryFile(
            suffix=".jac", mode="w", delete=False, encoding="utf-8"
        ) as f:
            f.write(jac_code)
            tmp_path = f.name
        result = subprocess.run(["jac", "check", tmp_path], ...)
        ...
    finally:
        if tmp_path and os.path.exists(tmp_path):    # ← guard against None
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
```

---

## 🟡 MEDIUM — Edge Case Failures

---

### BUG-8 · `backend/core/pipeline.py` — `repo_name` may display with `.git` suffix

**File:** `backend/core/pipeline.py` — line ~75

**Problem:**  
```python
repo_name = github_url.rstrip("/").split("/")[-1]
```
If the URL is `https://github.com/user/repo.git`, `repo_name` becomes `"repo.git"` — used in
log messages, plan prompts, and the README prompt. `github_client.py` already strips `.git` from
the API call, but `pipeline.py` doesn't strip it from the display name.

**Fix:**
```python
repo_name = github_url.rstrip("/").split("/")[-1].removesuffix(".git")
```

---

### BUG-9 · `backend/core/job_store.py` — Jobs never cleaned up (memory leak)

**File:** `backend/core/job_store.py`

**Problem:**  
`_jobs` dictionary grows forever. Each entry holds an `asyncio.Queue`, preview data (can be
large — all file contents), and a zip path string. Over time the process will exhaust memory.

**Fix — add a cleanup function and call it after download:**
```python
import time

_job_timestamps: dict[str, float] = {}

def create_job(job_id: str):
    _jobs[job_id] = {"queue": asyncio.Queue(), "preview": None, "zip_path": None}
    _job_timestamps[job_id] = time.time()
    _evict_old_jobs()

def _evict_old_jobs(max_age_seconds: int = 3600):
    """Remove jobs older than 1 hour."""
    cutoff = time.time() - max_age_seconds
    stale = [jid for jid, ts in _job_timestamps.items() if ts < cutoff]
    for jid in stale:
        _jobs.pop(jid, None)
        _job_timestamps.pop(jid, None)
        # also delete the ZIP file
        path = _output_paths.pop(jid, None)
        if path and os.path.exists(path):
            os.unlink(path)
```

---

### BUG-10 · `backend/core/pipeline.py` vs `backend/utils/github_client.py` — `MAX_FILES` default inconsistency

**Files:** Both files  

**Problem:**  
Both files independently read the same `MAX_FILES` env var but with different defaults:

| File | Default |
|------|---------|
| `pipeline.py` | `10` |
| `github_client.py` | `50` |

`github_client` fetches up to 50 files, then `pipeline.py` truncates to 10. The double cap is
confusing and wastes GitHub API calls fetching 50 when only 10 will be used.

**Fix — use a single source of truth in `github_client.py` and pass the limit as a parameter,
or align the defaults:**
```python
# github_client.py — change default to match pipeline
MAX_FILES = int(os.getenv("MAX_FILES", 10))   # ← was 50
```

---

### BUG-11 · `frontend/app/convert/[jobId]/page.js` — SSE native network error not handled  

**File:** `frontend/app/convert/[jobId]/page.js` — line ~51

**Problem:**  
```javascript
es.addEventListener("error", (e) => {
    const data = JSON.parse(e.data);    // ← throws if e.data is undefined
    ...
});
```
The `"error"` listener catches two different things:
1. A custom `event: error` from the server (has `e.data` as JSON)
2. A native browser SSE network error (has `e.data = undefined`)

When the network drops, `JSON.parse(undefined)` throws a `SyntaxError` which is caught by the
outer `catch (_) {}` and sets `errorMsg = "Connection lost"`. This works but the root cause
(network error vs server error) is indistinguishable.

**Fix — check `e.data` before parsing:**
```javascript
es.addEventListener("error", (e) => {
    try {
        if (e.data) {
            const data = JSON.parse(e.data);
            setErrorMsg(data.message || "Conversion failed");
        } else {
            // Native SSE connection error (network drop, server down, etc.)
            setErrorMsg("Lost connection to server. Check that the backend is running.");
        }
    } catch (_) {
        setErrorMsg("Connection lost");
    }
    es.close();
    setState(STATE.ERROR);
});
```

---

## 🟢 LOW — Code Quality & Maintenance

---

### BUG-12 · `backend/api/main.py` — CORS locked to `localhost:3000` only

**File:** `backend/api/main.py`

**Problem:**  
```python
allow_origins=["http://localhost:3000"],
```
If deployed to any server (even `localhost:3001` or a cloud URL), the frontend will receive CORS
errors and all API calls will fail.

**Fix — use an env var with sensible default:**
```python
import os

ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

And add to `backend/.env`:
```
CORS_ORIGINS=http://localhost:3000
```

---

### BUG-13 · `backend/.env` — Live API keys committed to repository  

**File:** `backend/.env`  
**File:** `.gitignore`

**Problem:**  
`ANTHROPIC_API_KEY` and `GITHUB_TOKEN` are real credentials stored in a file tracked by git.
Anyone with access to this repo can use them. Anthropic charges per token; GitHub tokens
can access/destroy your repos.

**Immediate action required:**
1. Rotate `ANTHROPIC_API_KEY` at https://console.anthropic.com
2. Revoke `GITHUB_TOKEN` at https://github.com/settings/tokens
3. Add `.env` to `.gitignore`:

```gitignore
# backend/.env  ← add this line to .gitignore
backend/.env
```

4. Use `backend/.env.example` (already exists) as the committed template with placeholder values.

---

### BUG-14 · `docker-compose.yml` — No explicit Docker network

**File:** `docker-compose.yml`

**Problem:**  
No `networks:` block defined. Docker Compose creates an implicit default bridge network.
This works, but if you ever run multiple Compose stacks, service name collisions can route
traffic to the wrong container.

**Fix — add explicit network:**
```yaml
services:
  backend:
    networks:
      - app-network
  frontend:
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

---

### BUG-15 · `docker-compose.yml` — Volume mounts override `node_modules`

**File:** `docker-compose.yml`

**Problem:**  
```yaml
volumes:
  - ./frontend:/app          # ← binds local frontend over /app
  - /app/node_modules        # ← anonymous volume preserves node_modules
  - /app/.next               # ← anonymous volume preserves next cache
```

The anonymous volumes (`/app/node_modules`, `/app/.next`) correctly prevent the local dir from
overwriting the container-built `node_modules`. However, if you run `npm install` locally (on
Windows), the Windows-built `node_modules` can leak into the container on the first mount before
the anonymous volume takes precedence.

**Fix — delete local `node_modules` if switching between local and Docker dev, or always use
the container for package installs.**

---

### BUG-16 · `frontend/next.config.js` — `NEXT_PUBLIC_API_URL` works only in dev mode

**File:** `frontend/next.config.js`

**Problem:**  
`NEXT_PUBLIC_*` env vars are **baked into the JS bundle at build time** by Next.js. In
`npm run dev`, they are re-read from the process environment on each restart which is why
Docker dev works. But in `npm run build` + `npm start` (production), the value from
docker-compose `environment` is NOT available during the Docker image build step — so the
rewrite will fall back to `http://localhost:8000` in production images.

**Fix — use a server-side (non-NEXT_PUBLIC_) env var for rewrites:**
```js
// next.config.js
const nextConfig = {
  async rewrites() {
    // INTERNAL_API_URL is server-side — read at runtime even in production
    const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:8000";
    return [
      { source: "/api/:path*", destination: `${apiUrl}/:path*` },
    ];
  },
};
module.exports = nextConfig;
```

And in `docker-compose.yml`:
```yaml
environment:
  - INTERNAL_API_URL=http://backend:8000   # ← server-side, not NEXT_PUBLIC_
```

---

## Missing Code Summary

| # | What's Missing | Where | Impact |
|---|----------------|-------|--------|
| M1 | `await` on all `llm()` calls in `pipeline.py` | `pipeline.py` | 🔴 Event loop blocks |
| M2 | `create_job()` called before returning response | `convert.py` | 🔴 Race condition |
| M3 | Job existence wait-loop in stream | `stream.py` | 🔴 False "Job not found" |
| M4 | Job cleanup / eviction logic | `job_store.py` | 🟡 Memory leak |
| M5 | Global error handler in `main.py` | `main.py` | 🟠 500 errors show stack traces to users |
| M6 | Rate limit / request throttling | `convert.py` | 🟡 Single IP can exhaust Anthropic credits |
| M7 | `/api/jobs` list endpoint | routes | 🟢 No way to list or cancel running jobs |
| M8 | `output: "standalone"` in `next.config.js` | `next.config.js` | 🟠 Production Docker build won't work |

---

## Global Error Handler (Missing — M5)

Add to `backend/api/main.py` to prevent stack traces leaking to the browser:

```python
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Check backend logs."},
    )
```

---

## Priority Fix Order

```
1. BUG-1  — Make llm() async (run_in_executor)           ← pipeline.py
2. BUG-2  — pre-create job, use BackgroundTasks           ← convert.py  
3. BUG-3  — add wait loop in stream.py                    ← stream.py
4. BUG-6  — upgrade next to 14.2.35                       ← package.json
5. BUG-13 — rotate leaked API keys, add .env to .gitignore
6. BUG-7  — fix tmp_path NameError in syntax_validator    ← syntax_validator.py
7. M5     — add global error handler                      ← main.py
8. BUG-4  — fix stream_url prefix                         ← convert.py
9. BUG-8  — strip .git from repo_name display             ← pipeline.py
10. BUG-12 — CORS from env var                            ← main.py
```

---

## Files With No Bugs

| File | Status |
|------|--------|
| `backend/api/main.py` | ✅ Correct (minor: CORS + missing global handler) |
| `backend/api/routes/preview.py` | ✅ Correct |
| `backend/api/routes/download.py` | ✅ Correct |
| `backend/core/job_store.py` | ✅ Correct (minor: no cleanup) |
| `backend/utils/github_client.py` | ✅ Correct (`.git` strip added) |
| `backend/utils/zip_builder.py` | ✅ Correct |
| `backend/prompts/*.py` | ✅ All correct |
| `backend/Dockerfile` | ✅ Correct |
| `frontend/app/layout.js` | ✅ Correct |
| `frontend/app/page.js` | ✅ Correct |
| `frontend/components/URLInput.js` | ✅ Correct |
| `frontend/components/ProgressStream.js` | ✅ Correct |
| `frontend/components/FileTree.js` | ✅ Correct |
| `frontend/components/CodePreview.js` | ✅ Correct |
| `frontend/components/SummaryCard.js` | ✅ Correct |
| `frontend/components/DownloadButton.js` | ✅ Correct |
| `frontend/app/convert/[jobId]/page.js` | ✅ Correct (minor: SSE error handling) |
| `frontend/jsconfig.json` | ✅ Correct |
