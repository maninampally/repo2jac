# 🔄 Repo-to-Jac Converter Agent
> Velric Miami Hackathon · Agentic AI Track

Convert any public Python GitHub repository into idiomatic **Jac/Jaseci** code —
with a generated README, demo script, and downloadable ZIP — in under 60 seconds.

---

## What We Built

An agentic AI application that takes a GitHub URL and runs a multi-step
conversion pipeline powered by Jac walkers and Claude (via `by LLM()`).

The agent analyzes each file, builds an OSP mapping plan, converts Python
classes to Jac nodes and walkers, validates syntax, retries on failure,
and packages the output as a ready-to-run Jac project.

---

## What It Does

1. **Fetches** all `.py` files from any public GitHub repo
2. **Analyzes** each file's role (model / controller / service / util) via LLM
3. **Plans** the OSP mapping — which classes become nodes, which become walkers
4. **Converts** each file to Jac with a retry loop (up to 3 attempts per file)
5. **Validates** generated code using `jac check` CLI
6. **Assembles** a ZIP with `.jac` files + README + `demo.sh`
7. **Streams** live progress to the frontend via SSE

---

## Why It Matters

Every developer exploring Jac/Jaseci faces the same question:
**"How do I translate my existing Python code into OSP concepts?"**

Repo-to-Jac eliminates that onboarding friction entirely.
It also directly grows the Jac ecosystem by making it trivial to
port existing Python projects.

---

## What Makes It Agentic

| Property | Implementation |
|---|---|
| **Goal** | Convert a Python repo to idiomatic Jac |
| **Tools** | GitHub API, `jac check` CLI, Claude via `by LLM()`, ZIP builder |
| **Loop** | Generate → Validate → Retry (up to 3x) → Fallback |
| **Guardrails** | Syntax validation, confidence scoring, fallback skeleton |
| **Product Surface** | Web UI with live progress stream + diff view + download |

---

## Where Jac & Jaseci Is Used

| File | Usage |
|---|---|
| `jac/main.jac` | Entry point — builds graph, spawns all walkers |
| `jac/nodes/*.jac` | OSP node definitions (RepoNode, FileNode, PlanNode, OutputNode) |
| `jac/walkers/analyzer_walker.jac` | Classifies file roles via `by LLM()` |
| `jac/walkers/planner_walker.jac` | Generates OSP mapping plan via `by LLM()` |
| `jac/walkers/converter_walker.jac` | Core agent loop — converts + retries via `by LLM()` |
| `jac/walkers/output_walker.jac` | Generates README + demo + ZIP via `by LLM()` |
| `utils/syntax_validator.py` | Runs `jac check` CLI to validate generated code |
| `core/pipeline.py` | Calls `JacMachine` to execute the Jac runtime |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Agent Backend | **Jac / Jaseci** (nodes, walkers, byLLM) |
| LLM | **Claude Sonnet** via Anthropic API |
| API | **FastAPI** + SSE streaming |
| Frontend | **Next.js** (App Router) |
| GitHub Ingestion | **PyGithub** |
| Containerization | **Docker Compose** |

---

## Setup — 3 Commands

```bash
# 1. Clone the repo
git clone https://github.com/your-team/repo-to-jac
cd repo-to-jac

# 2. Add your API keys
cp backend/.env.example backend/.env
# Edit backend/.env → add ANTHROPIC_API_KEY and GITHUB_TOKEN

# 3. Start everything
docker-compose up
```

- Frontend → http://localhost:3000
- Backend API → http://localhost:8000
- API Docs → http://localhost:8000/docs

---

## Manual Setup (without Docker)

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add your keys
uvicorn api.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Demo Flow (2–3 min)

1. Open http://localhost:3000
2. Paste: `https://github.com/your-team/repo-to-jac` → click **examples/todo-app**
3. Watch the live progress stream — see each file analyzed and converted
4. Click any file in the tree → view side-by-side Python vs Jac diff
5. Check confidence scores (green ✅ / yellow ⚠️ / red ❌)
6. Click **Download ZIP** → unzip → run `bash demo.sh`

> 💡 **Tip:** The `examples/todo-app/` folder in this repo is a pre-built
> demo input. Use it for a guaranteed clean demo.

---

## Project Structure

```
repo-to-jac/
├── backend/
│   ├── api/           # FastAPI routes (convert, stream, preview, download)
│   ├── core/          # Pipeline orchestrator + job store
│   ├── jac/           # Jac agent (nodes + walkers + main.jac)
│   ├── prompts/       # LLM prompt templates
│   └── utils/         # GitHub client, syntax validator, ZIP builder
├── frontend/
│   ├── app/           # Next.js pages (home + results)
│   └── components/    # URLInput, ProgressStream, FileTree, CodePreview, etc.
├── examples/
│   └── todo-app/      # Sample Python repo for demo
├── docker-compose.yml
└── README.md
```

---

## Team

Built at **Velric Miami Hackathon** · Agentic AI Track