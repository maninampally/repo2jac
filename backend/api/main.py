import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="Repo-to-Jac API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    from api.routes import convert, stream, preview, download
    app.include_router(convert.router)
    app.include_router(stream.router)
    app.include_router(preview.router)
    app.include_router(download.router)
    print("✅ All routes loaded")
except Exception as e:
    print(f"❌ Route load failed: {e}")
    traceback.print_exc()


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    print(f"❌ Unhandled error:\n{tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": tb}
    )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "repo-to-jac"}