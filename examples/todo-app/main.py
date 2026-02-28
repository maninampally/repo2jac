# =============================================================
# examples/todo-app/main.py
#
# PURPOSE:
#   FastAPI app entry point for the Todo app.
#   This file will be converted to Jac entry point by the agent.
#   The agent classifies this as role: "controller"
#
# EXPECTED JAC OUTPUT:
#   with entry {
#       root ++> UserNode(...);
#       spawn CreateTodoWalker() on root;
#   }
# =============================================================

from fastapi import FastAPI
from routes import router

app = FastAPI(
    title       = "Todo App",
    description = "A simple todo list API — demo repo for Repo-to-Jac converter",
    version     = "1.0.0",
)

app.include_router(router)


@app.get("/")
def root():
    return {
        "message": "Todo App API",
        "docs":    "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


# Run with: uvicorn main:app --reload