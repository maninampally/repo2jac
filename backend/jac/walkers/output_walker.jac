# =============================================================
# jac/walkers/output_walker.jac
#
# WHAT IT DOES:
#   The final walker. After all files are converted, this walker:
#     1. Collects all converted FileNodes
#     2. Generates a developer README via byLLM
#     3. Generates a demo.sh script via byLLM
#     4. Calls Python zip_builder to package everything
#     5. Creates an OutputNode with all results attached to RepoNode
#
# PIPELINE POSITION:  [4th and final walker to run]
#   AnalyzerWalker → PlannerWalker → ConverterWalker → OutputWalker
#
# INPUT:  RepoNode with all FileNodes fully converted
# OUTPUT: OutputNode attached to RepoNode via [produces] edge
#         ZIP file on disk, path stored in OutputNode.zip_path
#
# JAC CONCEPTS USED:
#   - walker                  : the workflow
#   - can ... with RepoNode entry : runs once at the end
#   - [-->(`?FileNode)]       : collect all converted files
#   - by LLM()                : generate README + demo script
#   - import:py               : call Python zip_builder
#   - +[produces]+>           : typed edge to OutputNode
# =============================================================

import:jac from nodes.repo_node    { RepoNode }
import:jac from nodes.file_node    { FileNode }
import:jac from nodes.output_node  { OutputNode }
import:py  from utils.zip_builder  { build_zip }

walker OutputWalker {

    can assemble with RepoNode entry {

        # Collect all converted FileNodes
        files = [-->(`?FileNode)];

        if not files {
            report "ERROR: No FileNodes found to assemble.";
            disengage;
        }

        # Build the jac_files dict for the ZIP
        jac_files    = {};
        total_conf   = 0.0;
        review_list  = [];

        for f in files {
            out_path = f.path.replace(".py", ".jac");
            jac_files[out_path] = f.jac_code;
            total_conf         += f.confidence;

            if f.confidence < 0.75 {
                review_list.append(f.path);
            }
        }

        avg_conf = total_conf / len(files);

        # Generate README via byLLM
        report "Generating README...";
        file_summaries = [
            {
                "path":       f.path.replace(".py", ".jac"),
                "role":       f.role,
                "confidence": f.confidence,
                "validated":  f.validated
            }
            for f in files
        ];

        readme = generate_readme(
            repo_name      = here.name,
            file_summaries = file_summaries,
            avg_confidence = avg_conf,
            review_needed  = review_list
        ) by LLM(
            model       = "claude-sonnet-4-20250514",
            temperature = 0.3,
            incl_info   = (here.name, file_summaries, avg_conf, review_list)
        );

        # Generate demo.sh via byLLM
        report "Generating demo script...";
        demo_script = generate_demo_script(
            repo_name  = here.name,
            main_file  = list(jac_files.keys())[0]
        ) by LLM(
            model       = "claude-sonnet-4-20250514",
            temperature = 0.1,
            incl_info   = (here.name,)
        );

        # Package ZIP using Python utility (import:py)
        report "Building ZIP...";
        zip_path = build_zip(
            job_id      = here.name,
            jac_files   = jac_files,
            readme      = readme,
            demo_script = demo_script
        );

        # Create OutputNode and attach to RepoNode
        output = OutputNode(
            jac_files      = jac_files,
            readme         = readme,
            demo_script    = demo_script,
            zip_path       = zip_path,
            total_files    = len(files),
            avg_confidence = avg_conf,
            review_needed  = review_list
        );

        here +[produces]+> output;  # RepoNode --[produces]--> OutputNode

        report "✅ Conversion complete!";
        report "   Files:       " + str(len(files));
        report "   Avg conf:    " + str(round(avg_conf * 100, 1)) + "%";
        report "   Needs review: " + str(len(review_list)) + " files";
        report "   ZIP:         " + zip_path;
    }
}

# ------------------------------------------------------------------
# byLLM ability — generates the project README
# ------------------------------------------------------------------
can generate_readme(
    repo_name:      str,
    file_summaries: list,
    avg_confidence: float,
    review_needed:  list
) -> str
    by LLM(model = "claude-sonnet-4-20250514", temperature = 0.3) {
        """
        Generate a clean developer README.md for a Jac/Jaseci project
        that was converted from a Python repository.

        Include these sections:
        1. Project title and one-line description
        2. OSP Design Decisions (why classes became nodes vs walkers)
        3. File structure with brief descriptions
        4. Setup: pip install jaseci → jac run main.jac
        5. Quick demo walkthrough
        6. Files needing manual review (if any) with guidance

        Write in clean Markdown. Be concise and practical.
        """
    }

# ------------------------------------------------------------------
# byLLM ability — generates demo.sh shell script
# ------------------------------------------------------------------
can generate_demo_script(repo_name: str, main_file: str) -> str
    by LLM(model = "claude-sonnet-4-20250514", temperature = 0.1) {
        """
        Generate a minimal bash demo script (demo.sh) that:
        1. Checks if jaseci is installed, installs if missing
        2. Copies .env.example to .env (reminds user to add API key)
        3. Runs: jac run main.jac
        4. Shows expected output as comments

        Under 25 lines. Use bash. Add comments. Beginner-friendly.
        """
    }