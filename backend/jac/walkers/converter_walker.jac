# jac/walkers/converter_walker.jac

import:jac from nodes.repo_node   { RepoNode }
import:jac from nodes.file_node   { FileNode }
import:jac from nodes.plan_node   { PlanNode }
import:py  from utils.syntax_validator { validate_jac_syntax }

walker ConverterWalker {
    has plan: PlanNode = None;
    has max_retries: int = 3;

    can start with RepoNode entry {
        plan_nodes = [-->(`?PlanNode)];

        if plan_nodes {
            self.plan = plan_nodes[0];
        } else {
            report "ERROR: No PlanNode found. Run PlannerWalker first.";
            disengage;
        }

        ordered_paths   = self.plan.conversion_order;
        all_file_nodes  = [-->(`?FileNode)];

        for path in ordered_paths {
            for fn in all_file_nodes {
                if fn.path == path {
                    visit fn;
                }
            }
        }
    }

    can convert with FileNode entry {
        report "Converting: " + here.path;

        context = {
            "node_mappings":   self.plan.node_mappings,
            "walker_mappings": self.plan.walker_mappings,
            "edge_mappings":   self.plan.edge_mappings
        };

        while here.retry_count <= self.max_retries {

            here.jac_code = generate_jac_code(
                file_path      = here.path,
                role           = here.role,
                original_code  = here.original_code,
                osp_context    = context,
                previous_error = here.error_log
            );

            is_valid, err_msg = validate_jac_syntax(here.jac_code);

            if is_valid {
                here.validated = true;
                here.confidence = score_jac_quality(
                    original  = here.original_code,
                    converted = here.jac_code,
                    role      = here.role
                );
                report here.path + " ✓  confidence: " + str(here.confidence);
                break;

            } else {
                here.retry_count += 1;
                here.error_log    = err_msg;
                report here.path + " ✗  retry " + str(here.retry_count) + ": " + err_msg;

                if here.retry_count > self.max_retries {
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

# byLLM ability — generates Jac code from Python source
can generate_jac_code(
    file_path:      str,
    role:           str,
    original_code:  str,
    osp_context:    dict,
    previous_error: str
) -> str
    by LLM(
        model       = "claude-sonnet-4-20250514",
        temperature = 0.2,
        incl_info   = (file_path, role, original_code, osp_context, previous_error)
    ) {
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

# byLLM ability — scores the quality of generated Jac code
can score_jac_quality(original: str, converted: str, role: str) -> float
    by LLM(
        model       = "claude-sonnet-4-20250514",
        temperature = 0.0,
        incl_info   = (original, converted, role)
    ) {
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
