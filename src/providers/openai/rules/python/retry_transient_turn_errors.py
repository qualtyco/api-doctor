"""openai-retry-transient-turn-errors

Parity with the JS rule: a `responses.create()` call inside a `try` block
with no turn-level retry — neither a surrounding loop nor a retry call in any
except handler — ends the entire run on any exception that survives the
SDK's own internal retry budget.
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
from utils import find_responses_create_call  # noqa: E402

RULE_KEY = "openai-retry-transient-turn-errors"

RETRY_NAME_RE = re.compile(r"retry", re.I)


def _has_retry_call(node: ast.AST) -> bool:
    for n in ast.walk(node):
        if not isinstance(n, ast.Call):
            continue
        name = None
        if isinstance(n.func, ast.Name):
            name = n.func.id
        elif isinstance(n.func, ast.Attribute):
            name = n.func.attr
        if name and RETRY_NAME_RE.search(name):
            return True
    return False


def _visit(node: ast.AST, loop_depth: int, out: list[dict], path: str) -> None:
    if isinstance(node, (ast.For, ast.AsyncFor, ast.While)):
        loop_depth += 1

    if isinstance(node, ast.Try):
        create_call = None
        for stmt in node.body:
            create_call = find_responses_create_call(stmt)
            if create_call:
                break
        if create_call and loop_depth == 0 and node.handlers:
            has_retry = any(_has_retry_call(h) for h in node.handlers)
            if not has_retry:
                handler = node.handlers[0]
                line, col, _, _ = loc(handler)
                out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    for child in ast.iter_child_nodes(node):
        _visit(child, loop_depth, out, path)


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []
    _visit(tree, 0, out, path)
    return out
