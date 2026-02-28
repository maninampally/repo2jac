# =============================================================
# examples/todo-app/routes.py
#
# PURPOSE:
#   HTTP route handlers for the Todo app.
#   This file will be converted to Jac WALKERS by the agent.
#   The agent classifies this as role: "controller"
#
# EXPECTED JAC OUTPUT:
#   walker CreateTodoWalker { can run with TodoNode entry {...} }
#   walker GetTodosWalker   { can run with UserNode entry {...} }
#   walker UpdateTodoWalker { can run with TodoNode entry {...} }
#   walker DeleteTodoWalker { can run with TodoNode entry {...} }
# =============================================================

from fastapi import APIRouter, HTTPException
from models import Todo, User
from services import TodoService

router = APIRouter(prefix="/todos", tags=["todos"])
svc    = TodoService()


@router.get("/")
def get_all_todos():
    return svc.get_all()


@router.get("/{todo_id}")
def get_todo(todo_id: int):
    todo = svc.get_by_id(todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todo


@router.post("/")
def create_todo(title: str, user_id: int = None):
    return svc.create(title=title, user_id=user_id)


@router.put("/{todo_id}")
def update_todo(todo_id: int, title: str = None, completed: bool = None):
    todo = svc.update(todo_id, title=title, completed=completed)
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todo


@router.delete("/{todo_id}")
def delete_todo(todo_id: int):
    ok = svc.delete(todo_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Todo not found")
    return {"deleted": True}