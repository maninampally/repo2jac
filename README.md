# Repo-to-Jac

> **Velric Miami Hackathon · Agentic AI Track**

Convert any public GitHub repository into idiomatic **Jac / Jaseci** code — complete with a generated README, demo script, and downloadable ZIP — in under 60 seconds.

[![CI](https://github.com/maninampally/repo2jac/actions/workflows/ci.yml/badge.svg)](https://github.com/maninampally/repo2jac/actions/workflows/ci.yml)

---

## Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [What Makes It Agentic](#what-makes-it-agentic)
4. [Jac & Jaseci Integration](#jac--jaseci-integration)
5. [Tech Stack](#tech-stack)
6. [Project Structure](#project-structure)
7. [Getting Started](#getting-started)
8. [Configuration](#configuration)
9. [CI / CD](#ci--cd)
10. [Team](#team)

---

## Overview

Every developer exploring Jac / Jaseci eventually asks:

> *"How do I translate my existing Python code into OSP concepts (nodes, edges, walkers) without rewriting everything by hand?"*

**Repo-to-Jac** removes that friction. Paste a GitHub URL, watch the agent work in real time, inspect Python-to-Jac diffs with confidence scores, and download a ready-to-run Jac project.

**Key outcomes:**
- Gives newcomers an immediate, working Jac version of their own repo.
- Encourages experimentation with Jac on real code, not toy examples.
- Grows the Jac ecosystem by making it trivial to port existing Python projects into an AI-native, graph-based world.

---

## How It Works

The pipeline runs 6 stages in order, streaming live progress to the browser via SSE:

| Stage | What Happens |
|-------|-------------|
| **1. Fetch** | Pull files from any public GitHub repo via the GitHub REST API (up to `MAX_FILES`). |
| **2. Analyze** | Classify each file's role — `model`, `controller`, `service`, or `util` — using Claude via `by LLM()`. |
| **3. Plan** | Build a global OSP mapping: which concepts become Jac **nodes**, which become **walkers**, and how they connect. |
| **4. Convert** | Generate Jac code for each file using a retry loop (up to `MAX_RETRIES`). Validates syntax after each attempt; falls back to a skeleton on failure. |
| **5. Validate** | Run `jac check` style validation on every generated `.jac` file. Confidence badges: ✅ high / ⚠ medium / ❌ fallback. |
| **6. Assemble** | Package `.jac` files + generated `README.md` + `demo.sh` into a downloadable ZIP. |

---

## What Makes It Agentic

| Property | Implementation |
|---|---|
| **Goal** | Turn a GitHub repo into a runnable Jac / Jaseci project |
| **Tools** | GitHub API, Anthropic Claude, syntax validator, ZIP builder, SSE |
| **Loop** | Generate → Validate → Retry (up to `MAX_RETRIES`) → Fallback skeleton |
| **Guardrails** | Syntax checks, confidence scoring, per-file error logs, safe fallback templates |
| **Product Surface** | Web UI with URL input, live progress stream, diff viewer, ZIP download |

The pipeline is explicitly structured as an agent workflow: it plans across the repo, acts on each file, observes validation results, then refines or falls back when needed.

---

## Jac & Jaseci Integration

The core agent is written in **Jac** using OSP nodes and walkers with `by LLM()` abilities.

### Node Graph

```
RepoNode ──→ FileNode(s) ──→ PlanNode ──→ OutputNode
```

### Walkers

| Walker | File | What It Does |
|--------|------|-------------|
| `AnalyzerWalker` | `jac/walkers/analyzer_walker.jac` | Visits every `FileNode` and classifies its role via `by LLM()` |
| `PlannerWalker` | `jac/walkers/planner_walker.jac` | Reads all `FileNode` roles and generates the global OSP mapping plan |
| `ConverterWalker` | `jac/walkers/converter_walker.jac` | Core agent loop — generates Jac, validates syntax, retries, and falls back |
| `OutputWalker` | `jac/walkers/output_walker.jac` | Generates project `README.md` + `demo.sh`, creates `OutputNode` |

### Example: `by LLM()` Ability

```jac
# jac/walkers/analyzer_walker.jac

can classify_file_role(file_path: str, source_code: str) -> str
    by LLM(
        model       = "claude-sonnet-4-20250514",
        temperature = 0.1,
        incl_info   = (file_path, source_code)
    ) {
        """
        Classify the given Python file's role as exactly one of:
        model, controller, service, util.
        Respond with ONLY one word.
        """
    }
```

### Jac Files

| Path | Purpose |
|------|---------|
| `backend/jac/main.jac` | Entry point — builds the graph and spawns all walkers in order |
| `backend/jac/nodes/repo_node.jac` | `RepoNode` — holds repo URL and metadata |
| `backend/jac/nodes/file_node.jac` | `FileNode` — holds original code, role, Jac output, retry state |
| `backend/jac/nodes/plan_node.jac` | `PlanNode` — holds the OSP mapping plan |
| `backend/jac/nodes/output_node.jac` | `OutputNode` — holds generated README + demo script |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Agent Orchestration | **Jac / Jaseci** (nodes, walkers, `by LLM()`) |
| LLM | **Claude** via Anthropic API (`anthropic >= 0.40.0`) |
| Backend API | **FastAPI 0.111** with async SSE streaming |
| Frontend | **Next.js 14** (App Router, fetch-based SSE) |
| GitHub Ingestion | **PyGithub** / GitHub REST API |
| Packaging | Python ZIP builder + generated `demo.sh` |
| Runtime | Python 3.11+, jaclang, **Docker Compose** |
| CI | GitHub Actions (Python syntax + imports + frontend build + npm audit) |

---

## Project Structure

```
repo-jac/
├── .github/
│   └── workflows/
│       └── ci.yml                  # GitHub Actions CI pipeline
├── backend/
│   ├── api/
│   │   ├── main.py                 # FastAPI app, CORS, exception handler
│   │   └── routes/
│   │       ├── convert.py          # POST /api/convert — starts pipeline job
│   │       ├── stream.py           # GET  /api/stream/{job_id} — SSE events
│   │       ├── preview.py          # GET  /api/preview/{job_id} — file preview
│   │       └── download.py         # GET  /api/download/{job_id} — ZIP download
│   ├── core/
│   │   ├── pipeline.py             # 6-stage async conversion pipeline
│   │   └── job_store.py            # In-memory job state + TTL eviction
│   ├── jac/
│   │   ├── main.jac                # Jac entry point
│   │   ├── nodes/                  # RepoNode, FileNode, PlanNode, OutputNode
│   │   └── walkers/                # Analyzer, Planner, Converter, Output walkers
│   ├── prompts/                    # LLM prompt templates
│   ├── utils/
│   │   ├── github_client.py        # GitHub repo file fetcher
│   │   ├── syntax_validator.py     # `jac check` wrapper
│   │   └── zip_builder.py          # ZIP packager
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── app/
│   │   ├── page.js                 # Home — URL input form
│   │   └── convert/[jobId]/
│   │       └── page.js             # Results — SSE stream, diff viewer, download
│   ├── components/
│   │   ├── URLInput.js
│   │   ├── ProgressStream.js
│   │   ├── FileTree.js
│   │   └── CodePreview.js
│   ├── next.config.js
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- An [Anthropic API key](https://console.anthropic.com/)
- A [GitHub personal access token](https://github.com/settings/tokens) (recommended — avoids rate limits)

### Quick Start (Docker — recommended)

```bash
# 1. Clone the repo
git clone https://github.com/maninampally/repo2jac.git
cd repo2jac

# 2. Configure environment variables
cp backend/.env.example backend/.env
# Open backend/.env and fill in:
#   ANTHROPIC_API_KEY=sk-ant-...
#   GITHUB_TOKEN=ghp_...

# 3. Start everything
docker-compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

### Local Development (without Docker)

```bash
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### Try a Conversion

1. Open **http://localhost:3000**
2. Paste any public GitHub URL (e.g. `https://github.com/tiangolo/fastapi`)
3. Watch the live progress: **Fetch → Analyze → Plan → Convert → Assemble**
4. Click a file to see the side-by-side Python → Jac diff with confidence badges
5. Click **Download ZIP**, unzip, and run:

```bash
cd converted-project
bash demo.sh
```

---

## Configuration

All settings in `backend/.env`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | ✅ Yes | — | Anthropic API key for Claude |
| `GITHUB_TOKEN` | Recommended | — | GitHub PAT to avoid 60 req/hr rate limit |
| `JAC_MODEL` | No | `claude-3-haiku-20240307` | Claude model name |
| `MAX_FILES` | No | `50` | Max files fetched per repo |
| `MAX_RETRIES` | No | `1` | Retry attempts per file on syntax failure |
| `MAX_PARALLEL` | No | `5` | Max concurrent LLM requests |
| `JOB_TTL_SECONDS` | No | `3600` | How long job results are kept in memory |

---

## CI / CD

GitHub Actions runs on every push and pull request to `main`.

**Backend job** (`ubuntu-latest`, Python 3.11):
- Install all dependencies from `requirements.txt` (excluding `jaclang`)
- `python -m compileall` — syntax check all Python files
- Import checks for all 6 critical modules
- Validate `docker-compose.yml` YAML structure

**Frontend job** (`ubuntu-latest`, Node 18):
- `npm ci` — clean install from lock file
- `npm run build` — full Next.js production build
- `npm audit --audit-level=critical` — fail on critical CVEs only

---

## Team

Built at the **Velric Miami Hackathon — Agentic AI Track**

GitHub: [https://github.com/maninampally/repo2jac](https://github.com/maninampally/repo2jac)


Convert any public GitHub repository into idiomatic **Jac/Jaseci** code — with a generated README, demo script, and downloadable ZIP — in under 60 seconds.

The agent analyzes each file, builds an OSP mapping plan, converts source files to Jac nodes and walkers, validates syntax, retries on failure, and packages the output as a ready‑to‑run Jac project.

---

## What We Built

An **agentic AI application** that takes a GitHub URL and runs a multi‑step conversion pipeline powered by **Jac walkers** and **Claude via `by LLM()`**.

The pipeline:

- Ingests files from a repo (Python, README, and other text‑based files).
- Classifies each file’s role.
- Plans an OSP mapping across the whole codebase.
- Generates Jac code, a rich README, and a `demo.sh` script.
- Packages everything as a reusable Jac/Jaseci project.

---

## What It Does

1. **Fetches** files from any public GitHub repository.  
2. **Analyzes** each file’s role (model / controller / service / util / other) via LLM.  
3. **Plans** the OSP mapping — which concepts become Jac **nodes**, which become **walkers**, and how they connect.  
4. **Converts** each file to Jac using a retry loop (up to `MAX_RETRIES` attempts per file).  
5. **Validates** generated code using a Jac syntax validator (mirroring `jac check`).  
6. **Assembles** a ZIP with `.jac` files, a structured README, and a `demo.sh` script.  
7. **Streams** live progress to the frontend via SSE so you can watch the agent work.

You paste a GitHub URL, watch the stages run in real time, inspect Python→Jac diffs, and download the converted Jac project.

---

## Why It Matters

Every developer exploring Jac/Jaseci eventually asks:

> **“How do I translate my existing Python code into OSP concepts (nodes, edges, walkers) without rewriting everything by hand?”**

**Repo‑to‑Jac** removes that friction:

- Gives newcomers an immediate, working Jac version of their own repo.  
- Encourages experimentation with Jac on **real code**, not just toy examples.  
- Grows the Jac ecosystem by making it trivial to port existing Python projects into an AI‑native, graph‑based world.

For the Velric Agentic AI Track, this is a **developer‑facing agent** that creates new Jac apps from arbitrary codebases.

---

## What Makes It Agentic

| Property        | Implementation                                                                 |
|----------------|---------------------------------------------------------------------------------|
| **Goal**       | Turn a GitHub repo into a runnable Jac/Jaseci project                           |
| **Tools**      | GitHub API, Anthropic Claude, syntax validator, ZIP builder, SSE                |
| **Loop**       | Generate → Validate → Retry (up to `MAX_RETRIES`) → Fallback skeleton           |
| **Guardrails** | Syntax checks, confidence scoring, per‑file error logs, safe fallback templates |
| **Product Surface** | Web UI with URL input, live progress stream, diff viewer, ZIP download    |

The pipeline is explicitly structured as an agent workflow: it plans across the repo, acts on each file, observes validation results, then refines or falls back when needed.

---

## Where Jac & Jaseci Is Used

| File / Folder                         | Usage |
|--------------------------------------|-------|
| `backend/jac/main.jac`               | Entry point — builds the graph and spawns all walkers in order |
| `backend/jac/nodes/*.jac`            | OSP **nodes**: `RepoNode`, `FileNode`, `PlanNode`, `OutputNode` |
| `backend/jac/walkers/analyzer_walker.jac`  | Uses `by LLM()` to classify file roles |
| `backend/jac/walkers/planner_walker.jac`   | Uses `by LLM()` to generate the global OSP plan |
| `backend/jac/walkers/converter_walker.jac` | Core agent loop — generate Jac, validate, retry, and fallback |
| `backend/jac/walkers/output_walker.jac`    | Uses `by LLM()` to generate README + `demo.sh` and create `OutputNode` |
| `backend/utils/syntax_validator.py`        | Validates Jac code using CLI / parser rules |
| `backend/core/pipeline.py`                 | Orchestrates the LLM pipeline and calls `JacMachine` to run Jac |

---

## Tech Stack

| Layer              | Technology                                  |
|--------------------|---------------------------------------------|
| Agent Orchestration | **Jac / Jaseci** (nodes, walkers, `by LLM`) |
| LLM                | **Claude** via Anthropic API                |
| Backend API        | **FastAPI** with SSE streaming              |
| Frontend           | **Next.js** (App Router)                    |
| GitHub Ingestion   | **PyGithub** / GitHub REST API              |
| Packaging          | Python ZIP builder + generated `demo.sh`    |
| Runtime            | Python 3.11+, `jac` CLI, **Docker Compose** |

---

## Setup — 3 Commands (Docker)

```bash
# 1. Clone the repo
git clone https://github.com/your-org/repo-to-jac.git
cd repo-to-jac

# 2. Add your API keys
cp backend/.env.example backend/.env
# Edit backend/.env → set ANTHROPIC_API_KEY, GITHUB_TOKEN, and Jac model if needed

# 3. Start everything
docker-compose up


Once the containers are up:

Frontend → http://localhost:3000

Backend API → http://localhost:8000

API Docs → http://localhost:8000/docs

Demo Flow (2–3 Minutes)
Open http://localhost:3000.

Paste a GitHub URL (for example, the sample repo in examples/todo-app) and start a conversion.

Watch the live progress:

Fetch → Analyze → Plan → Convert → Assemble.

Click a file in the tree to see side‑by‑side original vs Jac (diff view).

Check confidence badges on each file (✅ high, ⚠ medium, ❌ fallback).

Click Download ZIP, unzip it, and run the generated demo:

bash
cd converted-project
bash demo.sh

Project Structure

repo-to-jac/
├── backend/
│   ├── api/             # FastAPI routes (convert, stream, preview, download)
│   ├── core/            # Pipeline orchestrator + job store + SSE events
│   ├── jac/             # Jac agent (nodes + walkers + main.jac)
│   ├── prompts/         # LLM prompt templates (Python helpers)
│   └── utils/           # GitHub client, syntax validator, ZIP builder
├── frontend/
│   ├── app/             # Next.js pages (home + results)
│   └── components/      # URLInput, ProgressStream, FileTree, CodePreview, etc.
├── examples/
│   └── todo-app/        # Sample Python repo for guaranteed demo
├── docker-compose.yml
└── README.md


Configuration & Limits
Key environment variables in backend/.env:

ANTHROPIC_API_KEY – required for LLM calls.

GITHUB_TOKEN – recommended to avoid GitHub rate limits.

JAC_MODEL – Claude model name used in the Python pipeline.

MAX_FILES – maximum files processed per repo (set high or adjust logic if you want full repos).

MAX_RETRIES – how many times the agent retries a failed file conversion.

MAX_PARALLEL – maximum concurrent LLM calls.

These knobs let you balance speed, robustness, and token usage.

Team
Built at Velric Miami Hackathon – Agentic AI Track
