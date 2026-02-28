# =============================================================
# jac/walkers/analyzer_walker.jac
#
# WHAT IT DOES:
#   Walks every FileNode connected to the RepoNode and
#   classifies each file's role using byLLM.
#
# WHY IT EXISTS:
#   Before we can convert anything, we need to understand
#   what each file does. Is it a data model? A route handler?
#   A service? A utility? This role classification tells the
#   ConverterWalker what Jac patterns to apply.
#
# PIPELINE POSITION:  [1st walker to run]
#   AnalyzerWalker → PlannerWalker → ConverterWalker → OutputWalker
#
# INPUT:  FileNode with path + original_code
# OUTPUT: FileNode with role filled in ("model"|"controller"|"service"|"util")
#
# JAC CONCEPTS USED:
#   - walker         : defines the workflow
#   - can ... with FileNode entry : runs when visiting a FileNode
#   - by LLM()       : calls Claude to classify the file
#   - visit [-->]    : moves to the next connected FileNode
# =============================================================

import:jac from nodes.repo_node  { RepoNode }
import:jac from nodes.file_node  { FileNode }

walker AnalyzerWalker {

    # Entry point: start at RepoNode, then visit all FileNodes
    can start with RepoNode entry {
        visit [-->(`?FileNode)];  # walk to all FileNodes connected to RepoNode
    }

    # For each FileNode: classify its role via byLLM
    can analyze with FileNode entry {

        here.role = classify_file_role(
            file_path   = here.path,
            source_code = here.original_code
        ) by LLM(
            model       = "claude-sonnet-4-20250514",
            temperature = 0.1  # low temp = consistent classification
        );

        report "Analyzed: " + here.path + " → " + here.role;

        # Move to next FileNode
        visit [-->(`?FileNode)];
    }
}

# ------------------------------------------------------------------
# byLLM ability — this is how Jac calls Claude inline
# The docstring IS the system prompt sent to the LLM
# incl_info tells Jac which variables to include as context
# ------------------------------------------------------------------
can classify_file_role(file_path: str, source_code: str) -> str
    by LLM(
        model       = "claude-sonnet-4-20250514",
        temperature = 0.1,
        incl_info   = (file_path, source_code)
    ) {
        """
        You are an expert Python architect.
        Classify the given Python file's role as exactly one of:
        model, controller, service, util.

        - model:      data structures, ORM models, Pydantic schemas
        - controller: HTTP routes, request/response handling
        - service:    business logic, orchestration, external API calls
        - util:       helpers, constants, config, shared functions

        Respond with ONLY one word. No explanation.
        """
    }