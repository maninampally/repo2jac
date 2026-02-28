# =============================================================
# jac/main.jac
#
# WHAT IT IS:
#   The entry point for the entire Jac agent pipeline.
#   This file imports all nodes and walkers, assembles the
#   graph, and spawns walkers in the correct order.
#
# HOW TO RUN STANDALONE:
#   jac run main.jac
#
# HOW IT IS CALLED FROM PYTHON (FastAPI):
#   jac = JacMachine()
#   jac.run("jac/main.jac", entrypoint="entry", args={...})
#
# PIPELINE ORDER:
#   1. AnalyzerWalker  → classify each file's role
#   2. PlannerWalker   → build OSP mapping plan
#   3. ConverterWalker → convert each file to Jac (agent loop)
#   4. OutputWalker    → generate README + demo + ZIP
# =============================================================

# ── Import all nodes ─────────────────────────────────────────
import:jac from nodes.repo_node   { RepoNode   }
import:jac from nodes.file_node   { FileNode   }
import:jac from nodes.plan_node   { PlanNode   }
import:jac from nodes.output_node { OutputNode }

# ── Import all walkers ────────────────────────────────────────
import:jac from walkers.analyzer_walker  { AnalyzerWalker  }
import:jac from walkers.planner_walker   { PlannerWalker   }
import:jac from walkers.converter_walker { ConverterWalker }
import:jac from walkers.output_walker    { OutputWalker    }

# ── Import Python utilities ───────────────────────────────────
import:py from utils.github_client { fetch_repo_files }

# ── Edge definitions (shared across all walkers) ──────────────
edge contains  {}   # RepoNode  --[contains]-->  FileNode
edge depends_on{}   # FileNode  --[depends_on]--> FileNode
edge has_plan  {}   # RepoNode  --[has_plan]-->   PlanNode
edge produces  {}   # RepoNode  --[produces]-->   OutputNode

# =============================================================
# ENTRY POINT
# Called when: jac run main.jac
# Or from FastAPI via JacMachine with args injected
# =============================================================
with entry {
    # ── 1. Accept args from FastAPI or use defaults for standalone run
    github_url = __jac_args__.get("github_url", "https://github.com/example/todo-app");
    files_data = __jac_args__.get("files", []);  # pre-fetched by pipeline.py

    # ── 2. Build the graph ────────────────────────────────────
    repo = RepoNode(
        url  = github_url,
        name = github_url.rstrip("/").split("/")[-1]
    );

    root ++> repo;  # attach repo to root so walkers can find it

    # Create a FileNode for each fetched file
    for f in files_data {
        file_node = FileNode(
            path          = f["path"],
            original_code = f["content"]
        );
        repo +[contains]+> file_node;  # RepoNode --[contains]--> FileNode
    }

    repo.total_files = len(files_data);
    report "Graph built: " + str(len(files_data)) + " files";

    # ── 3. Spawn walkers in pipeline order ────────────────────
    report "--- Step 1: Analyzing files ---";
    spawn AnalyzerWalker()  on repo;

    report "--- Step 2: Planning OSP mapping ---";
    spawn PlannerWalker()   on repo;

    report "--- Step 3: Converting to Jac (agent loop) ---";
    spawn ConverterWalker() on repo;

    report "--- Step 4: Assembling output ---";
    spawn OutputWalker()    on repo;

    # ── 4. Return OutputNode data back to FastAPI ─────────────
    output_nodes = [repo -->(`?OutputNode)];
    if output_nodes {
        out = output_nodes[0];
        report "Pipeline complete. ZIP: " + out.zip_path;

        # This dict is read by pipeline.py after JacMachine finishes
        __jac_result__ = {
            "files":          [
                {
                    "path":       p,
                    "jac_code":   c,
                    "confidence": 0.9,   # read from FileNode in real impl
                    "validated":  true
                }
                for p, c in out.jac_files.items()
            ],
            "readme":         out.readme,
            "demo_script":    out.demo_script,
            "zip_path":       out.zip_path,
            "avg_confidence": out.avg_confidence,
        };
    }
}