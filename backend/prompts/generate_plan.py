import json


def generate_plan_prompt(repo_name: str, files: list) -> str:
    summaries = [
        {
            "path":    f["path"],
            "role":    f.get("role", "util"),
            "snippet": f["content"][:300]
        }
        for f in files
    ]
    return f"""You are a Jac/Jaseci OSP architect.
Given these Python source files from repo "{repo_name}", produce a JSON mapping plan
for converting to idiomatic Jac/Jaseci.

Files:
{json.dumps(summaries, indent=2)}

Return a JSON object with exactly these keys:
{{
  "nodes":   [{{"original_class": "str", "jac_node": "str", "fields": ["str"]}}],
  "walkers": [{{"original": "str", "jac_walker": "str", "purpose": "str"}}],
  "edges":   [{{"from_node": "str", "to_node": "str", "edge_name": "str"}}],
  "order":   ["str"]
}}

Rules:
- Data classes / models → Jac nodes
- Route handlers / business logic → Jac walkers
- Object relationships → Jac edges
- order: list file paths with dependencies first

Respond with ONLY valid JSON. No explanation, no markdown."""