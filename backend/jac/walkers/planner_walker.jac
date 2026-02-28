# =============================================================
# jac/walkers/planner_walker.jac
#
# WHAT IT DOES:
#   Visits the RepoNode, collects ALL analyzed FileNodes,
#   and uses byLLM to generate a global OSP mapping plan.
#   The plan tells ConverterWalker exactly how to convert
#   each file into idiomatic Jac.
#
# WHY IT EXISTS:
#   If we converted files one-by-one without a global view,
#   the generated Jac code would be inconsistent — one file
#   might call a node "User" while another calls it "UserModel".
#   The planner sees the WHOLE repo and creates a unified blueprint.
#
# PIPELINE POSITION:  [2nd walker to run]
#   AnalyzerWalker → PlannerWalker → ConverterWalker → OutputWalker
#
# INPUT:  RepoNode with all FileNodes already analyzed (roles set)
# OUTPUT: PlanNode attached to RepoNode via [has_plan] edge
#
# JAC CONCEPTS USED:
#   - walker          : the workflow
#   - can ... with RepoNode entry : runs once at the repo level
#   - [-->(`?FileNode)] : collect all connected FileNodes
#   - by LLM()        : generate OSP plan from all file summaries
#   - +[has_plan]+>   : create a typed edge to the new PlanNode
# =============================================================

import:jac from nodes.repo_node  { RepoNode }
import:jac from nodes.file_node  { FileNode }
import:jac from nodes.plan_node  { PlanNode }

walker PlannerWalker {

    can plan with RepoNode entry {

        # Collect all FileNodes and build a summary list for the LLM
        files = [-->(`?FileNode)];

        file_summaries = [];
        for f in files {
            file_summaries.append({
                "path":    f.path,
                "role":    f.role,
                "snippet": f.original_code[:400]  # first 400 chars as context
            });
        }

        # Ask LLM to generate the full OSP mapping plan
        plan_data = generate_osp_plan(
            repo_name      = here.name,
            file_summaries = file_summaries
        ) by LLM(
            model       = "claude-sonnet-4-20250514",
            temperature = 0.2,
            incl_info   = (here.name, file_summaries)
        );

        # Create PlanNode and attach it to RepoNode with a typed edge
        plan = PlanNode(
            node_mappings     = plan_data.get("nodes",   []),
            walker_mappings   = plan_data.get("walkers", []),
            edge_mappings     = plan_data.get("edges",   []),
            conversion_order  = plan_data.get("order",   [f.path for f in files])
        );

        here +[has_plan]+> plan;  # create typed edge: RepoNode --[has_plan]--> PlanNode

        report "Plan created: "
            + str(len(plan.node_mappings))   + " nodes, "
            + str(len(plan.walker_mappings)) + " walkers, "
            + str(len(plan.edge_mappings))   + " edges";
    }
}

# ------------------------------------------------------------------
# byLLM ability — generates the full OSP conversion blueprint
# Returns a dict with nodes, walkers, edges, and conversion order
# ------------------------------------------------------------------
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
          "order":   [str]  // file paths, dependencies first
        }

        Rules:
        - Data classes / ORM models → Jac nodes
        - Route handlers / business logic flows → Jac walkers
        - Relationships between models → Jac edges
        - order must list dependencies before the files that import them

        Respond with ONLY valid JSON. No explanation, no markdown.
        """
    }