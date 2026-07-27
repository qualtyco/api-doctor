"""openai-realtime-reconnect-on-drop

Parity with the JS rule: an except handler for a dropped Realtime connection
(`websockets.exceptions.ConnectionClosed` and friends) that only logs and
never attempts to reconnect permanently kills the call in that direction.
"""
from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

from ast_utils import loc

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import (  # noqa: E402
    collect_realtime_socket_var_names,
    collect_realtime_url_var_names,
    is_realtime_connect_call,
    is_tracked_socket_ref,
)

RULE_KEY = "openai-realtime-reconnect-on-drop"

RECONNECT_NAME_RE = re.compile(r"reconnect", re.I)
CONNECTION_CLOSED_RE = re.compile(r"connectionclosed", re.I)


def _handler_type_names(expr: ast.AST | None) -> list[str]:
    if expr is None:
        return []
    if isinstance(expr, ast.Tuple):
        names: list[str] = []
        for el in expr.elts:
            names.extend(_handler_type_names(el))
        return names
    if isinstance(expr, ast.Attribute):
        return [expr.attr]
    if isinstance(expr, ast.Name):
        return [expr.id]
    return []


def _handler_matches_connection_closed(handler: ast.ExceptHandler) -> bool:
    return any(CONNECTION_CLOSED_RE.search(n) for n in _handler_type_names(handler.type))


def _has_reconnect_attempt(nodes: list[ast.stmt], url_var_names: set[str]) -> bool:
    for stmt in nodes:
        for n in ast.walk(stmt):
            if isinstance(n, ast.Call):
                if is_realtime_connect_call(n, url_var_names):
                    return True
                name = n.func.id if isinstance(n.func, ast.Name) else (
                    n.func.attr if isinstance(n.func, ast.Attribute) else None
                )
                if name and RECONNECT_NAME_RE.search(name):
                    return True
    return False


def _try_touches_realtime(node: ast.Try, url_var_names: set[str], socket_var_names: set[str]) -> bool:
    for stmt in node.body:
        for n in ast.walk(stmt):
            if isinstance(n, ast.Call) and is_realtime_connect_call(n, url_var_names):
                return True
            if is_tracked_socket_ref(n, socket_var_names):
                return True
    return False


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    url_var_names = collect_realtime_url_var_names(tree)
    socket_var_names = collect_realtime_socket_var_names(tree)
    if not url_var_names and not socket_var_names:
        return []

    out: list[dict] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Try):
            continue
        if not _try_touches_realtime(node, url_var_names, socket_var_names):
            continue

        for handler in node.handlers:
            if not _handler_matches_connection_closed(handler):
                continue
            if _has_reconnect_attempt(handler.body, url_var_names):
                continue
            line, col, _, _ = loc(handler)
            out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
