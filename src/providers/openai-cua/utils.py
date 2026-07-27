"""Shared AST helpers for OpenAI Computer Use Python rules."""

from __future__ import annotations

import ast

from ast_utils import call_ends_with, kwarg_names  # noqa: F401 — re-exported for rule modules


def is_responses_create_call(call: ast.Call) -> bool:
    """True for `client.responses.create(...)` / `openai.responses.create(...)`."""
    return call_ends_with(call, "responses", "create")


def find_responses_create_call(node: ast.AST) -> ast.Call | None:
    """First `responses.create(...)` call within a subtree, else None."""
    for n in ast.walk(node):
        if isinstance(n, ast.Call) and is_responses_create_call(n):
            return n
    return None
