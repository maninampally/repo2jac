def generate_demo_prompt(repo_name: str) -> str:
    return f"""Generate a minimal bash demo script (demo.sh) for a Jac project
converted from the Python repo "{repo_name}".

The script should:
1. Check if jaseci is installed, install if missing
2. Copy .env.example to .env and remind user to add API key
3. Run: jac run main.jac
4. Print expected output as comments

Keep it under 25 lines. Use bash. Add comments. Make it beginner-friendly."""