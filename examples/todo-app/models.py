# =============================================================
# examples/todo-app/models.py
#
# PURPOSE:
#   Defines the data models for the Todo app.
#   This file will be converted to a Jac NODE by the agent.
#   The agent classifies this as role: "model"
#
# EXPECTED JAC OUTPUT:
#   node TodoNode { has id, title, completed, created_at }
#   node UserNode { has id, name, email }
# =============================================================

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class User:
    id:         int
    name:       str
    email:      str
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Todo:
    id:          int
    title:       str
    completed:   bool          = False
    user_id:     Optional[int] = None
    created_at:  datetime      = field(default_factory=datetime.utcnow)
    updated_at:  datetime      = field(default_factory=datetime.utcnow)


@dataclass
class TodoList:
    id:    int
    name:  str
    todos: list[Todo] = field(default_factory=list)