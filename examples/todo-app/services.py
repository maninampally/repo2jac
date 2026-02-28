# =============================================================
# examples/todo-app/services.py
#
# PURPOSE:
#   Business logic layer for the Todo app.
#   This file will be converted to Jac WALKERS by the agent.
#   The agent classifies this as role: "service"
#
# EXPECTED JAC OUTPUT:
#   walker TodoServiceWalker {
#       can get_all  with TodoNode entry { visit [-->] }
#       can create   with UserNode entry { ... }
#       can update   with TodoNode entry { ... }
#       can delete   with TodoNode entry { ... }
#   }
# =============================================================

from datetime import datetime
from models import Todo


class TodoService:
    def __init__(self):
        # In-memory store (would be a DB in production)
        self._todos: dict[int, Todo] = {}
        self._next_id = 1

    def get_all(self) -> list[Todo]:
        return list(self._todos.values())

    def get_by_id(self, todo_id: int) -> Todo | None:
        return self._todos.get(todo_id)

    def get_by_user(self, user_id: int) -> list[Todo]:
        return [t for t in self._todos.values() if t.user_id == user_id]

    def create(self, title: str, user_id: int = None) -> Todo:
        todo = Todo(
            id      = self._next_id,
            title   = title,
            user_id = user_id,
        )
        self._todos[self._next_id] = todo
        self._next_id += 1
        return todo

    def update(self, todo_id: int, title: str = None, completed: bool = None) -> Todo | None:
        todo = self._todos.get(todo_id)
        if not todo:
            return None
        if title is not None:
            todo.title = title
        if completed is not None:
            todo.completed = completed
        todo.updated_at = datetime.utcnow()
        return todo

    def delete(self, todo_id: int) -> bool:
        if todo_id in self._todos:
            del self._todos[todo_id]
            return True
        return False