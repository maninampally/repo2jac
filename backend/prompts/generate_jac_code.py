def generate_jac_code_prompt(
    file_path: str,
    role: str,
    original_code: str,
    plan_json: str,
    previous_error: str = ""
) -> str:
    error_section = ""
    if previous_error:
        error_section = f"""
A previous conversion attempt failed with this error:
{previous_error}
Fix this specific error in your response.
"""
    return f"""You are an expert Jac/Jaseci developer.
Convert the Python source file below to idiomatic Jac code.

OSP mapping plan:
{plan_json[:800]}

File: {file_path}
Role: {role}
{error_section}
Source code:
```python
{original_code}
```

Jac conversion rules:
- Use `node` for data models (NOT Python classes)
- Use `walker` for workflows and business logic
- Use `has` for node fields with types and defaults
- Use `can ... with NodeType entry` for walker abilities
- Use `edge` for typed relationships between nodes
- Use `visit [-->]` to traverse the graph
- Use `import:py` to call Python utility functions
- Use `by LLM()` only for AI inference tasks
- Do NOT use Python class syntax inside .jac files
- Every walker must have at least one `can` ability

Return ONLY valid Jac code. No markdown fences, no explanation."""