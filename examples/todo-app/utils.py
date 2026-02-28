# =============================================================
# examples/todo-app/utils.py
#
# PURPOSE:
#   Shared helper functions for the Todo app.
#   This file will be converted to Jac utility functions.
#   The agent classifies this as role: "util"
#
# EXPECTED JAC OUTPUT:
#   can format_date(dt: str) -> str { ... }
#   can paginate(items: list, page: int, size: int) -> dict { ... }
#   can validate_email(email: str) -> bool by LLM() { ... }
# =============================================================

from datetime import datetime


def format_date(dt: datetime) -> str:
    """Format a datetime to a readable string."""
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def paginate(items: list, page: int = 1, page_size: int = 10) -> dict:
    """Return a paginated slice of a list."""
    total  = len(items)
    start  = (page - 1) * page_size
    end    = start + page_size
    return {
        "items":      items[start:end],
        "total":      total,
        "page":       page,
        "page_size":  page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


def validate_email(email: str) -> bool:
    """Basic email format validation."""
    return "@" in email and "." in email.split("@")[-1]


def sanitize_title(title: str) -> str:
    """Strip and truncate a todo title."""
    return title.strip()[:200]


def is_overdue(due_date: datetime) -> bool:
    """Check if a todo's due date has passed."""
    return datetime.utcnow() > due_date