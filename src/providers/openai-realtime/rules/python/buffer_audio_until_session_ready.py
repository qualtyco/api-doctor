"""openai-realtime-buffer-audio-until-session-ready

Parity with the JS rule: audio that arrives before the Realtime socket
reaches its open/ready state must be queued and flushed once open, not
dropped by an early-return branch.
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

RULE_KEY = "openai-realtime-buffer-audio-until-session-ready"

STATE_ATTR_NAMES = frozenset({"state", "readyState", "ready_state"})
FLAG_NAME_RE = re.compile(r"open|ready|connected", re.I)
QUEUE_CALL_RE = re.compile(r"^(append|put|enqueue|queue|push)$", re.I)


def _is_state_expr(node: ast.AST) -> bool:
    if isinstance(node, ast.Attribute):
        return node.attr in STATE_ATTR_NAMES or bool(FLAG_NAME_RE.search(node.attr))
    if isinstance(node, ast.Name):
        return bool(FLAG_NAME_RE.search(node.id))
    return False


def _is_open_value(node: ast.AST) -> bool:
    if isinstance(node, ast.Attribute) and node.attr == "OPEN":
        return True
    if isinstance(node, ast.Constant):
        if node.value is True or node.value == 1:
            return True
        if isinstance(node.value, str) and node.value.upper() == "OPEN":
            return True
    return False


def _check_kind(test: ast.AST) -> str | None:
    if isinstance(test, ast.UnaryOp) and isinstance(test.op, ast.Not):
        return "is-not-open" if _is_state_expr(test.operand) else None

    if isinstance(test, ast.Compare) and len(test.ops) == 1:
        op = test.ops[0]
        left, right = test.left, test.comparators[0]
        matches = (_is_state_expr(left) and _is_open_value(right)) or (
            _is_state_expr(right) and _is_open_value(left)
        )
        if not matches:
            return None
        if isinstance(op, ast.Eq):
            return "is-open"
        if isinstance(op, ast.NotEq):
            return "is-not-open"
        return None

    if _is_state_expr(test):
        return "is-open"

    return None


def _has_queue_call(stmts: list[ast.stmt]) -> bool:
    for stmt in stmts:
        for n in ast.walk(stmt):
            if not isinstance(n, ast.Call):
                continue
            name = n.func.attr if isinstance(n.func, ast.Attribute) else (
                n.func.id if isinstance(n.func, ast.Name) else None
            )
            if name and QUEUE_CALL_RE.match(name):
                return True
    return False


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []

    for node in ast.walk(tree):
        if not isinstance(node, ast.If):
            continue
        kind = _check_kind(node.test)
        if not kind:
            continue

        not_open_branch = node.body if kind == "is-not-open" else node.orelse
        if not not_open_branch:
            continue
        if _has_queue_call(not_open_branch):
            continue

        line, col, _, _ = loc(node)
        out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
