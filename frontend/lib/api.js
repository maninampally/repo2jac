// ─────────────────────────────────────────────────────────────
// lib/api.js
// Central API helper. All fetch calls go through here.
// Base URL is proxied via next.config.js → FastAPI at :8000
// ─────────────────────────────────────────────────────────────

const BASE = "";  // empty because next.config.js rewrites /api/* → FastAPI

// POST /convert — start a conversion job
export async function startConversion(githubUrl) {
  const res = await fetch(`${BASE}/api/convert`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ github_url: githubUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to start conversion");
  }
  return res.json(); // { job_id, status, stream_url }
}

// GET /preview/:jobId — fetch converted files for diff view
export async function getPreview(jobId) {
  const res = await fetch(`${BASE}/api/preview/${jobId}`);
  if (!res.ok) throw new Error("Preview not ready");
  return res.json(); // { files, readme, demo_script }
}

// GET /health — check if backend is alive
export async function checkHealth() {
  const res = await fetch(`${BASE}/api/health`);
  return res.ok;
}