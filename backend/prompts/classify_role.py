def classify_role_prompt(file_path: str, source_code: str) -> str:
    return f"""You are an expert Python architect.
Classify this Python file's role as exactly one of: model, controller, service, util.

- model:      data structures, ORM models, Pydantic schemas, dataclasses
- controller: HTTP routes, request/response handling, FastAPI/Flask routes
- service:    business logic, orchestration, external API calls
- util:       helpers, constants, config, shared functions

File path: {file_path}

Source code:
```python
{source_code[:1500]}
```

Respond with ONLY one word: model, controller, service, or util."""