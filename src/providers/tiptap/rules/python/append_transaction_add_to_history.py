"""tiptap-appendTransaction-add-to-history (python analog, correctness)

Real ProseMirror `appendTransaction` hooks are JS-only, but Python
collaboration backends that reimplement the same plugin hook shape (e.g. a
custom sync server driving a ProseMirror/Yjs-compatible protocol) reuse the
identical `appendTransaction` name, `tr` mutation calls, and `setMeta` guard.
This flags a `def append_transaction(...)` (or `appendTransaction`) whose body
calls a mutating transaction method without also calling
`tr.set_meta("addToHistory", False)`.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))

from utils import (  # noqa: E402
    APPEND_TRANSACTION_NAMES,
    MUTATING_METHOD_NAMES,
    func_or_method_name,
    function_named,
    loc,
)

RULE_KEY = "tiptap-appendTransaction-add-to-history"


def _has_add_to_history_meta(fn: ast.AST) -> bool:
    for node in ast.walk(fn):
        if not isinstance(node, ast.Call):
            continue
        if func_or_method_name(node.func) not in {"setMeta", "set_meta"}:
            continue
        if not node.args:
            continue
        first = node.args[0]
        if isinstance(first, ast.Constant) and first.value == "addToHistory":
            return True
    return False


def _has_mutation(fn: ast.AST) -> bool:
    for node in ast.walk(fn):
        if isinstance(node, ast.Call) and func_or_method_name(node.func) in MUTATING_METHOD_NAMES:
            return True
    return False


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []

    for node in ast.walk(tree):
        if not function_named(node, *APPEND_TRANSACTION_NAMES):
            continue
        if _has_mutation(node) and not _has_add_to_history_meta(node):
            line, col, end_line, end_col = loc(node)
            out.append(
                {
                    "file": path,
                    "line": line,
                    "column": col,
                    "endLine": end_line,
                    "endColumn": end_col,
                    "ruleKey": RULE_KEY,
                }
            )

    return out
