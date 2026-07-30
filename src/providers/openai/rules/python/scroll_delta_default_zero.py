"""openai-scroll-delta-default-zero

Parity with the JS rule: a missing vertical scroll delta (dy/delta_y/scroll_y)
must default to 0, not an arbitrary non-zero literal. Covers the two common
Python idioms: `dict.get(key, default)` and `if x is None: x = default`.
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

RULE_KEY = "openai-scroll-delta-default-zero"

VERTICAL_DELTA_NAME_RE = re.compile(r"^(dy|delta_?y|scroll_?y)$", re.I)


def _target_name(node: ast.AST | None) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    if isinstance(node, ast.Subscript):
        sl = node.slice
        if isinstance(sl, ast.Constant) and isinstance(sl.value, str):
            return sl.value
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _is_nonzero_number_literal(node: ast.AST | None) -> bool:
    return (
        isinstance(node, ast.Constant)
        and isinstance(node.value, (int, float))
        and not isinstance(node.value, bool)
        and node.value != 0
    )


def _bad_default(target: ast.AST | None, value: ast.AST | None) -> bool:
    name = _target_name(target)
    if not name or not VERTICAL_DELTA_NAME_RE.match(name):
        return False
    return _is_nonzero_number_literal(value)


def _is_none_check_target(test: ast.AST) -> str | None:
    """Target name for `x is None` / `x == None`, else None."""
    if not isinstance(test, ast.Compare) or len(test.ops) != 1:
        return None
    op = test.ops[0]
    if not isinstance(op, (ast.Is, ast.Eq)):
        return None
    left, right = test.left, test.comparators[0]
    if isinstance(right, ast.Constant) and right.value is None:
        return _target_name(left)
    if isinstance(left, ast.Constant) and left.value is None:
        return _target_name(right)
    return None


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []

    for node in ast.walk(tree):
        # `dy = payload.get("dy", 700)`
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "get":
            if len(node.args) >= 2:
                key_node, default_node = node.args[0], node.args[1]
                if _bad_default(key_node, default_node):
                    line, col, _, _ = loc(default_node)
                    out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})
            continue

        # `dy = dy or 700`
        if isinstance(node, ast.BoolOp) and isinstance(node.op, ast.Or) and len(node.values) == 2:
            left, right = node.values
            if _bad_default(left, right):
                line, col, _, _ = loc(node)
                out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})
            continue

        # `if dy is None: dy = 700`
        if isinstance(node, ast.If):
            name = _is_none_check_target(node.test)
            if not name:
                continue
            body = node.body
            if len(body) != 1 or not isinstance(body[0], ast.Assign) or len(body[0].targets) != 1:
                continue
            target = body[0].targets[0]
            if _target_name(target) != name:
                continue
            if _bad_default(target, body[0].value):
                line, col, _, _ = loc(node)
                out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
