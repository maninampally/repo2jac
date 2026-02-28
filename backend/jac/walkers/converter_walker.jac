# =============================================================
# jac/walkers/converter_walker.jac
#
# WHAT IT DOES:
#   The CORE agent loop. Walks each FileNode in dependency order,
#   generates idiomatic Jac code using byLLM, validates the
#   syntax using `jac check`, and retries up to 3 times if
#   the output is invalid. Falls back to a safe skeleton if
#   all retries fail.
#
# WHY IT IS AGENTIC:
#   This is not a single prompt. It:
#     1. Generates Jac code
#     2. Observes the result (syntax check)
#     3. If failed: injects the error into the next prompt (self-correction)
#     4. Retries with updated context
#     5. Falls back safely after max retries
#   This is the Plan → Act → Observe → Refine loop.
#
# PIPELINE POSITION:  [3rd walker to run]
#   AnalyzerWalker → PlannerWalker → ConverterWalker → OutputWalker
#
# INPUT:  RepoNode (reads PlanNode + all FileNodes)
# OUTPUT: Each FileNode has jac_code, validated, confidence filled in
#
# JAC CONCEPTS USED:
#   - walker with has fields  : walker carries state (plan, max_retries)
#   - can ... with RepoNode entry  : initialization step
#   - can ... with FileNode entry  : conversion step per file
#   - by LLM()               : generate Jac code + score confidence
#   - import:py              : call Python syntax validator
#   - visit [-->]            : move to next FileNode
# =============================================================

import:jac from nodes.repo_node   { RepoNode }
import:jac from nodes.file_node   { FileNode }
import:jac from nodes.plan_node   { PlanNode }
import:py  from utils.syntax_validator { validate_jac_syntax }

walker ConverterWalker {
    has plan: PlanNode = None;
    has max_retries: int = 3;

    # ── Step 1: Load the plan, then start walking FileNodes ───
    can start with RepoNode entry {
        plan_nodes = [-->(`?PlanNode)];

        if plan_nodes {
            self.plan = plan_nodes[0];
        } else {
            report "ERROR: No PlanNode found. Run PlannerWalker first.";
            disengage;
        }

        # Walk FileNodes in the dependency order defined by the plan
        ordered_paths = self.plan.conversion_order;
        all_file_nodes = [-->(`?FileNode)];

        # Visit in order
        for path in ordered_paths {
            for fn in all_file_nodes {
                if fn.path == path {
                    visit fn;
                }
            }
        }
    }

    # ── Step 2: Convert each FileNode (the agent loop) ────────
    can convert with FileNode entry {
        report "Converting: " + here.path;

        # Build context from plan for this specific file
        context = {
            "node_mappings":   self.plan.node_mappings,
            "walker_mappings": self.plan.walker_mappings,
            "edge_mappings":   self.plan.edge_mappings
        };

        # Agent loop: generate → validate → retry or accept
        while here.retry_count <= self.max_retries {

            # Generate Jac code via byLLM
            here.jac_code = generate_jac_code(
                file_path      = here.path,
                role           = here.role,
                original_code  = here.original_code,
                osp_context    = context,
                previous_error = here.error_log  # empty on first attempt
            ) by LLM(
                model       = "claude-sonnet-4-20250514",
                temperature = 0.2,
                incl_info   = (here.path, here.role, here.original_code, context, here.error_log)
            );

            # Validate syntax using jac check CLI (Python interop)
            is_valid, err_msg = validate_jac_syntax(here.jac_code);

            if is_valid {
                # ✅ Success — score the quality
                here.validated  = true;
                here.confidence = score_jac_quality(
                    original  = here.original_code,
                    converted = here.jac_code,
                    role      = here.role
                ) by LLM(
                    model       = "claude-sonnet-4-20250514",
                    temperature = 0.0,
                    incl_info   = (here.original_code, here.jac_code, here.role)
                );
                report here.path + " ✓  confidence: " + str(here.confidence);
                break;

            } else {
                # ❌ Syntax error — retry with error context injected
                here.retry_count += 1;
                here.error_log    = err_msg;
                report here.path + " ✗  retry " + str(here.retry_count) + ": " + err_msg;

                if here.retry_count > self.max_retries {
                    # All retries exhausted — use safe fallback skeleton
                    here.jac_code    = build_fallback(here.path, here.role);
                    here.confidence  = 0.5;
                    here.validated   = false;
                    report here.path + " ⚠  fallback used after " + str(self.max_retries) + " retries";
                    break;
                }
            }
        }
    }
}

# ------------------------------------------------------------------
# byLLM ability — generates Jac code from Python source
# previous_error is injected so LLM can self-correct on retry
# ------------------------------------------------------------------
can generate_jac_code(
    file_path:      str,
    role:           str,
    original_code:  str,
    osp_context:    dict,
    previous_error: str
) -> str
    by LLM(model = "claude-sonnet-4-20250514", temperature = 0.2) {
        """
        You are an expert Jac/Jaseci developer.
        Convert the Python source file to idiomatic Jac code.

        Jac rules to follow:
        - `node`    for data models (NOT Python classes)
        - `walker`  for workflows and business logic
        - `has`     for node fields with types and default values
        - `can ... with NodeType entry` for walker abilities
        - `edge`    for typed relationships between nodes
        - `visit [-->]` to traverse the graph
        - `import:py`   to call Python utility functions
        - `by LLM()`    only for AI inference tasks
        - Do NOT use Python class syntax inside .jac files

        If previous_error is non-empty, fix that exact error.

        Return ONLY valid Jac code. No markdown, no explanation.
        """
    }

# ------------------------------------------------------------------
# byLLM ability — scores the quality of generated Jac code
# Returns a float 0.0–1.0 so the UI can show confidence badges
# ------------------------------------------------------------------
can score_jac_quality(original: str, converted: str, role: str) -> float
    by LLM(model = "claude-sonnet-4-20250514", temperature = 0.0) {
        """
        You are a Jac code reviewer. Score the quality of this
        converted Jac code from 0.0 to 1.0.

        Consider:
        - Correct use of node, walker, edge, has, can, visit
        - Idiomatic Jac patterns (not just Python with Jac keywords)
        - Preservation of original logic and intent
        - Code clarity and structure

        Respond with ONLY a float. Example: 0.87
        No explanation, no other text.
        """
    }

# ------------------------------------------------------------------
# Fallback — safe minimal skeleton when all retries fail
# This ensures we never return empty/broken output
# ------------------------------------------------------------------
can build_fallback(path: str, role: str) -> str {
    name = role.capitalize();
    return "# AUTO-CONVERTED (fallback) — manual review recommended\n"
         + "# Original file: " + path + "\n\n"
         + "node " + name + "Node {\n"
         + "    has data: dict = {};\n"
         + "}\n\n"
         + "walker " + name + "Walker {\n"
         + "    can run with " + name + "Node entry {\n"
         + "        report \"Fallback for " + path + "\";\n"
         + "    }\n"
         + "}\n";
}