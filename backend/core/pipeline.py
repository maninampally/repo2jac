import os
import json
import asyncio
import logging
import traceback
import anthropic

from core.job_store import push_event, set_preview, set_output_path
from utils.github_client import fetch_repo_files
from utils.zip_builder import build_zip
from prompts.classify_role import classify_role_prompt
from prompts.generate_plan import generate_plan_prompt
from prompts.generate_jac_code import generate_jac_code_prompt
from prompts.generate_readme import generate_readme_prompt
from prompts.generate_demo import generate_demo_prompt

# ── Logging ───────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("pipeline")

# ── Config ────────────────────────────────────────────────────
API_KEY       = os.getenv("ANTHROPIC_API_KEY", "")
MODEL         = os.getenv("JAC_MODEL", "claude-3-haiku-20240307")
MAX_FILES     = int(os.getenv("MAX_FILES", 50))   # whole repo
MAX_RETRY     = int(os.getenv("MAX_RETRIES", 1))
MAX_PARALLEL  = int(os.getenv("MAX_PARALLEL", 5)) # concurrent LLM calls

if not API_KEY:
    log.error("❌ ANTHROPIC_API_KEY is not set!")

_client = None
def _get_client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=API_KEY)
    return _client

# ── Semaphore to limit concurrent API calls ───────────────────
_semaphore = None
def get_semaphore():
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(MAX_PARALLEL)
    return _semaphore


# ── Async LLM ─────────────────────────────────────────────────
def _llm_sync(prompt: str, temperature: float, max_tokens: int) -> str:
    resp = _get_client().messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        temperature=temperature,
        messages=[{"role": "user", "content": prompt}]
    )
    return resp.content[0].text.strip()

async def llm(prompt: str, temperature: float = 0.2, max_tokens: int = 4096) -> str:
    async with get_semaphore():  # limit concurrent calls
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _llm_sync, prompt, temperature, max_tokens)


# ── Convert a single file (used in parallel) ──────────────────
async def convert_file(f: dict, plan_str: str, job_id: str, index: int, total: int):
    log.info(f"Converting [{index+1}/{total}]: {f['path']}")
    error_log = ""
    f["jac_code"]   = ""
    f["validated"]  = False
    f["confidence"] = 0.5

    for attempt in range(MAX_RETRY + 1):
        try:
            jac_code = await llm(
                generate_jac_code_prompt(
                    f["path"], f["role"],
                    f["content"], plan_str, error_log
                ),
                temperature=0.2
            )
            # Strip markdown fences
            jac_code = jac_code.replace("```jac", "").replace("```", "").strip()

            # Basic quality check — does it have Jac keywords?
            has_node   = "node " in jac_code
            has_walker = "walker " in jac_code or "can " in jac_code
            has_has    = "has " in jac_code

            if has_node or has_walker or has_has:
                f["jac_code"]   = jac_code
                f["validated"]  = True
                f["confidence"] = 0.95 - (attempt * 0.08)
                log.info(f"  ✅ {f['path']} conf={f['confidence']:.2f}")
            else:
                # Fallback if no Jac keywords found
                f["jac_code"]   = _fallback(f["path"], f["role"])
                f["confidence"] = 0.55
                f["validated"]  = False
                log.warning(f"  ⚠ No Jac keywords found in output for {f['path']}")
            break

        except Exception as e:
            log.error(f"  ❌ LLM error for {f['path']}: {e}")
            error_log = str(e)
            if attempt == MAX_RETRY:
                f["jac_code"]   = _fallback(f["path"], f["role"])
                f["confidence"] = 0.50
                f["validated"]  = False

    pct = 45 + int((index + 1) / total * 38)
    push_event(job_id, "progress", {
        "step":       "convert",
        "pct":        pct,
        "file":       f["path"],
        "confidence": round(f["confidence"], 2),
        "validated":  f["validated"],
    })


async def run_pipeline(job_id: str, github_url: str, model: str):
    log.info(f"🚀 Pipeline started — job={job_id} url={github_url}")

    try:
        # ── STEP 1: Fetch ALL files ───────────────────────────
        push_event(job_id, "progress", {"step": "fetch", "pct": 5, "file": "Connecting to GitHub..."})

        try:
            files = fetch_repo_files(github_url)
        except Exception as e:
            log.error(f"❌ GitHub fetch failed: {e}")
            push_event(job_id, "error", {"message": f"GitHub error: {str(e)}", "recoverable": False})
            return

        if not files:
            push_event(job_id, "error", {"message": "No Python files found.", "recoverable": False})
            return

        # Cap at MAX_FILES
        files = files[:MAX_FILES]
        repo_name = github_url.rstrip("/").split("/")[-1].removesuffix(".git")
        log.info(f"✅ Fetched {len(files)} files from '{repo_name}'")

        push_event(job_id, "progress", {
            "step": "fetch", "pct": 15,
            "file": f"Found {len(files)} Python files in '{repo_name}'"
        })

        # ── STEP 2: Analyze ALL files IN PARALLEL ─────────────
        push_event(job_id, "progress", {"step": "analyze", "pct": 18, "file": "Analyzing file roles..."})

        async def analyze_file(f, i):
            try:
                role = (await llm(classify_role_prompt(f["path"], f["content"]), temperature=0.1)).lower().strip()
                f["role"] = role if role in ("model", "controller", "service", "util") else "util"
            except Exception:
                f["role"] = "util"
            pct = 18 + int((i + 1) / len(files) * 20)
            push_event(job_id, "progress", {"step": "analyze", "pct": pct, "file": f["path"], "role": f["role"]})

        # Run all analysis calls in parallel
        await asyncio.gather(*[analyze_file(f, i) for i, f in enumerate(files)])
        log.info("✅ Analysis complete")

        # ── STEP 3: Plan ──────────────────────────────────────
        push_event(job_id, "progress", {"step": "plan", "pct": 40, "file": "Building OSP plan..."})

        try:
            plan_raw  = await llm(generate_plan_prompt(repo_name, files), temperature=0.2)
            plan_raw  = plan_raw.replace("```json", "").replace("```", "").strip()
            plan_json = json.loads(plan_raw)
            log.info(f"✅ Plan: {len(plan_json.get('nodes', []))} nodes")
        except Exception as e:
            log.error(f"Plan failed: {e}")
            plan_json = {"nodes": [], "walkers": [], "edges": [], "order": [f["path"] for f in files]}

        conversion_order = plan_json.get("order", [f["path"] for f in files])
        order_index = {p: i for i, p in enumerate(conversion_order)}
        files.sort(key=lambda f: order_index.get(f["path"], 999))
        plan_str = json.dumps(plan_json, indent=2)

        push_event(job_id, "progress", {
            "step": "plan", "pct": 45,
            "file": f"Plan ready — {len(plan_json.get('nodes', []))} nodes mapped"
        })

        # ── STEP 4: Convert ALL files IN PARALLEL ─────────────
        log.info(f"STEP 4: Converting {len(files)} files in parallel (max {MAX_PARALLEL} at a time)...")

        await asyncio.gather(*[
            convert_file(f, plan_str, job_id, i, len(files))
            for i, f in enumerate(files)
        ])
        log.info("✅ All files converted")

        # ── STEP 5: README + demo IN PARALLEL ─────────────────
        push_event(job_id, "progress", {"step": "assemble", "pct": 85, "file": "Generating README..."})

        async def gen_readme():
            try:
                return await llm(generate_readme_prompt(repo_name, files), temperature=0.3)
            except Exception as e:
                log.error(f"README failed: {e}")
                return f"# {repo_name} — Converted to Jac\n\nRun: `jac run main.jac`\n"

        async def gen_demo():
            try:
                return await llm(generate_demo_prompt(repo_name), temperature=0.1)
            except Exception as e:
                log.error(f"Demo failed: {e}")
                return "#!/bin/bash\npip install jaseci\njac run main.jac\n"

        readme, demo = await asyncio.gather(gen_readme(), gen_demo())

        # ── STEP 6: ZIP ───────────────────────────────────────
        push_event(job_id, "progress", {"step": "assemble", "pct": 92, "file": "Building ZIP..."})

        jac_files = {f["path"].replace(".py", ".jac"): f.get("jac_code", "") for f in files}
        zip_path  = build_zip(job_id, jac_files, readme, demo)
        avg_conf  = sum(f.get("confidence", 0.5) for f in files) / len(files)

        set_preview(job_id, {
            "files": [
                {
                    "path":       f["path"].replace(".py", ".jac"),
                    "original":   f["content"],
                    "converted":  f.get("jac_code", ""),
                    "confidence": round(f.get("confidence", 0.5), 2),
                    "validated":  f.get("validated", False),
                }
                for f in files
            ],
            "readme":      readme,
            "demo_script": demo,
        })
        set_output_path(job_id, zip_path)

        log.info(f"🎉 Done — {len(files)} files, avg_conf={round(avg_conf, 2)}")
        push_event(job_id, "complete", {
            "download_url":   f"/download/{job_id}",
            "total_files":    len(files),
            "avg_confidence": round(avg_conf, 2),
        })

    except Exception as e:
        log.error(f"❌ Fatal: {e}\n{traceback.format_exc()}")
        push_event(job_id, "error", {"message": f"Pipeline error: {str(e)}", "recoverable": False})


def _fallback(path: str, role: str) -> str:
    name = role.capitalize()
    return (
        f"# AUTO-CONVERTED (fallback) — manual review recommended\n"
        f"# Original: {path}\n\n"
        f"node {name}Node {{\n"
        f"    has data: dict = {{}};\n"
        f"}}\n\n"
        f"walker {name}Walker {{\n"
        f"    can run with {name}Node entry {{\n"
        f"        report \"Fallback for {path}\";\n"
        f"    }}\n"
        f"}}\n"
    )