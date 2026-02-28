import os
from github import Github
from github.GithubException import UnknownObjectException

# Read from env — must match pipeline.py default
MAX_FILES  = int(os.getenv("MAX_FILES", 50))  # fetch limit; pipeline caps separately
SKIP_DIRS  = {"__pycache__", ".git", "tests", "test", "migrations", "venv", ".venv", "node_modules", "dist", "build"}
SKIP_FILES = {"setup.py", "conftest.py", "manage.py"}


def fetch_repo_files(github_url: str) -> list[dict]:
    token = os.getenv("GITHUB_TOKEN", "")
    g     = Github(token) if token else Github()

    clean = github_url.rstrip("/").replace(".git", "")
    parts = clean.replace("https://github.com/", "").split("/")

    if len(parts) < 2:
        raise ValueError(f"Invalid GitHub URL: {github_url}")

    owner, repo_name = parts[0], parts[1]

    try:
        repo = g.get_repo(f"{owner}/{repo_name}")
    except UnknownObjectException:
        raise ValueError(f"Repo not found or is private: {owner}/{repo_name}")

    files = []
    _walk(repo, "", files)
    return files[:MAX_FILES]


def _walk(repo, path: str, results: list):
    try:
        contents = repo.get_contents(path)
    except Exception:
        return
    for item in contents:
        if len(results) >= int(os.getenv("MAX_FILES", 50)):
            return
        if item.type == "dir":
            if item.name not in SKIP_DIRS:
                _walk(repo, item.path, results)
        elif item.type == "file" and _should_include(item.name):
            try:
                content = item.decoded_content.decode("utf-8", errors="replace")
                results.append({"path": item.path, "content": content})
            except Exception:
                pass


def _should_include(filename: str) -> bool:
    if not filename.endswith(".py"):
        return False
    if filename in SKIP_FILES:
        return False
    if filename.startswith("test_") or filename.endswith("_test.py"):
        return False
    return True