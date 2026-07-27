"""openai-realtime-handle-error-server-event

Parity with the JS rule: a Realtime message loop that branches on event
types but never checks for the API-level "error" event lets the connection
continue silently dead, with no operator-visible signal of why.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

from ast_utils import loc

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import collect_realtime_socket_var_names, is_tracked_socket_ref  # noqa: E402

RULE_KEY = "openai-realtime-handle-error-server-event"


def _is_type_expr(node: ast.AST) -> bool:
    if isinstance(node, ast.Attribute) and node.attr == "type":
        return True
    if isinstance(node, ast.Subscript) and isinstance(node.slice, ast.Constant) and node.slice.value == "type":
        return True
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "get"
        and node.args
        and isinstance(node.args[0], ast.Constant)
        and node.args[0].value == "type"
    ):
        return True
    return False


def _collect_type_comparison_literals(node: ast.AST, out: set[str]) -> None:
    for n in ast.walk(node):
        if isinstance(n, ast.Compare) and len(n.ops) == 1 and isinstance(n.ops[0], ast.Eq):
            left, right = n.left, n.comparators[0]
            if _is_type_expr(left) and isinstance(right, ast.Constant) and isinstance(right.value, str):
                out.add(right.value)
            elif _is_type_expr(right) and isinstance(left, ast.Constant) and isinstance(left.value, str):
                out.add(left.value)


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    socket_var_names = collect_realtime_socket_var_names(tree)
    if not socket_var_names:
        return []

    out: list[dict] = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.For, ast.AsyncFor)):
            continue
        if not is_tracked_socket_ref(node.iter, socket_var_names) or not isinstance(node.target, ast.Name):
            continue

        literals: set[str] = set()
        for stmt in node.body:
            _collect_type_comparison_literals(stmt, literals)

        # No type-dispatch pattern at all — not the shape this rule targets.
        if not literals:
            continue

        if "error" not in literals:
            line, col, _, _ = loc(node)
            out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
