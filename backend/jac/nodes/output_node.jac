# =============================================================
# jac/nodes/output_node.jac
#
# WHAT IT IS:
#   The final deliverable node. Created by OutputWalker after
#   all files have been converted. Holds everything needed
#   to build the downloadable ZIP.
#
# HOW IT FITS:
#   RepoNode --[produces]--> OutputNode
#   pipeline.py reads OutputNode to serve /preview and /download
#
# USED BY:
#   - OutputWalker (creates + populates this node)
#   - pipeline.py  (reads zip_path, readme, jac_files)
# =============================================================

node OutputNode {
    # Dict of { "models.jac": "node UserNode {...}", ... }
    has jac_files: dict = {};

    # Generated README.md content
    has readme: str = "";

    # Generated demo.sh content
    has demo_script: str = "";

    # File path to the packaged ZIP on disk
    has zip_path: str = "";

    # Summary stats
    has total_files: int = 0;
    has avg_confidence: float = 0.0;

    # List of files with confidence < 0.75 (need manual review)
    has review_needed: list = [];
}