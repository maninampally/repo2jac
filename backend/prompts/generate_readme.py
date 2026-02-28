def generate_readme_prompt(repo_name: str, files: list) -> str:
    file_list = "\n".join(
        f"- {f['path'].replace('.py', '.jac')} "
        f"(role: {f.get('role', '?')}, "
        f"confidence: {round(f.get('confidence', 0.5) * 100)}%)"
        for f in files
    )
    low_conf = [f for f in files if f.get("confidence", 1.0) < 0.75]
    review_note = ""
    if low_conf:
        review_note = "Files needing manual review:\n" + "\n".join(
            f"- {f['path']}" for f in low_conf
        )

    return f"""Generate a clean developer README.md for a Jac/Jaseci project
converted from the Python repo "{repo_name}".

Converted files:
{file_list}

{review_note}

Include these sections:
1. Project title and one-line description
2. OSP Design Decisions (why classes became nodes vs walkers)
3. File structure with brief descriptions
4. Setup: pip install jaseci → jac run main.jac
5. Quick demo walkthrough
6. Notes on any files needing manual review

Write in clean Markdown. Be concise and practical."""