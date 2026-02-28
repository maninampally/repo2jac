# jac/walkers/planner_walker.jac

import:jac from nodes.repo_node  { RepoNode }
import:jac from nodes.file_node  { FileNode }
import:jac from nodes.plan_node  { PlanNode }

walker PlannerWalker {

    can plan with RepoNode entry {

        files = [-->(`?FileNode)];

        file_summaries = [];
        for f in files {
            file_summaries.append({
                "path":    f.path,
                "role":    f.role,
                "snippet": f.original_code[:400]
            });
        }

        # Ask LLM to generate the full OSP mapping plan
        plan_data = generate_osp_plan(
            repo_name      = here.name,
            file_summaries = file_summaries
        );

        plan = PlanNode(
            node_mappings     = plan_data.get("nodes",   []),
            walker_mappings   = plan_data.get("walkers", []),
            edge_mappings     = plan_data.get("edges",   []),
            conversion_order  = plan_data.get("order",   [f.path for f in files])
        );

        here +[has_plan]+> plan;

        report "Plan created: "
            + str(len(plan.node_mappings))   + " nodes, "
            + str(len(plan.walker_mappings)) + " walkers, "
            + str(len(plan.edge_mappings))   + " edges";
    }
}

# byLLM ability — generates the full OSP conversion blueprint
can generate_osp_plan(repo_name: str, file_summaries: list) -> dict
    by LLM(
        model       = "claude-sonnet-4-20250514",
        temperature = 0.2,
        incl_info   = (repo_name, file_summaries)
    ) {
        """
        You are a Jac/Jaseci OSP architect.
        Given Python source file summaries, produce a JSON mapping plan
        for converting the repo to idiomatic Jac/Jaseci.

        Return a JSON object with exactly these keys:
        {
          "nodes":   [{"original_class": str, "jac_node": str, "fields": [str]}],
          "walkers": [{"original": str, "jac_walker": str, "purpose": str}],
          "edges":   [{"from_node": str, "to_node": str, "edge_name": str}],
          "order":   [str]
        }

        Rules:
        - Data classes / ORM models → Jac nodes
        - Route handlers / business logic flows → Jac walkers
        - Relationships between models → Jac edges
        - order must list dependencies before the files that import them

        Respond with ONLY valid JSON. No explanation, no markdown.
        """
    }
