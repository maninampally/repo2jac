# =============================================================
# jac/nodes/file_node.jac
#
# WHAT IT IS:
#   Represents a single Python source file from the repo.
#   This node is created for EACH .py file fetched from GitHub.
#   It starts empty (just path + original_code) and gets filled
#   in progressively as walkers process it.
#
# LIFECYCLE:
#   1. Created by pipeline.py with path + original_code
#   2. AnalyzerWalker fills in: role
#   3. ConverterWalker fills in: jac_code, validated, confidence
#   4. OutputWalker reads: jac_code to package into ZIP
#
# HOW IT FITS:
#   RepoNode --[contains]--> FileNode
#   FileNode --[depends_on]--> FileNode  (if it imports another file)
#
# USED BY:
#   - AnalyzerWalker  (classifies role)
#   - ConverterWalker (generates + validates jac_code)
#   - OutputWalker    (reads jac_code for ZIP)
# =============================================================

node FileNode {
    has path: str;                  # e.g. "app/models.py"
    has original_code: str;         # raw Python source code

    # Filled by AnalyzerWalker
    has role: str = "";             # "model" | "controller" | "service" | "util"

    # Filled by ConverterWalker
    has jac_code: str = "";         # generated Jac source code
    has validated: bool = false;    # did jac check pass?
    has confidence: float = 0.0;    # LLM self-score 0.0–1.0
    has retry_count: int = 0;       # how many retries were needed
    has error_log: str = "";        # last syntax error (used in retry prompt)
}