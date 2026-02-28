# jac/walkers/analyzer_walker.jac

import:jac from nodes.repo_node  { RepoNode }
import:jac from nodes.file_node  { FileNode }

walker AnalyzerWalker {

    # Entry point: start at RepoNode, then visit all FileNodes
    can start with RepoNode entry {
        visit [-->(`?FileNode)];
    }

    # For each FileNode: classify its role via byLLM
    can analyze with FileNode entry {

        here.role = classify_file_role(
            file_path   = here.path,
            source_code = here.original_code
        );

        report "Analyzed: " + here.path + " → " + here.role;

        visit [-->(`?FileNode)];
    }
}

# byLLM ability — this is how Jac calls the model inline
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
