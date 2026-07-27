"""tiptap-appendTransaction-full-scan (python analog, reliability)

Same rationale as the JS rule, ported for Python code that reimplements a
ProseMirror-style `appendTransaction` hook (custom collaboration/sync
backends): flags a `def append_transaction(...)` whose body calls
`doc.descendants(...)` on every invocation without first checking a
`doc_changed`/`docChanged` guard.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))

from utils import APPEND_TRANSACTION_NAMES, func_or_method_name, function_named, loc  # noqa: E402

RULE_KEY = "tiptap-appendTransaction-full-scan"

_DOC_CHANGED_NAMES = frozenset({"docChanged", "doc_changed"})


def _has_doc_changed_guard(fn: ast.AST) -> bool:
    for node in ast.walk(fn):
        if isinstance(node, ast.Attribute) and node.attr in _DOC_CHANGED_NAMES:
            return True
        if isinstance(node, ast.Name) and node.id in _DOC_CHANGED_NAMES:
            return True
    return False


def _has_descendants_call(fn: ast.AST) -> bool:
    for node in ast.walk(fn):
        if isinstance(node, ast.Call) and func_or_method_name(node.func) == "descendants":
            return True
    return False


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []

    for node in ast.walk(tree):
        if not function_named(node, *APPEND_TRANSACTION_NAMES):
            continue
        if _has_descendants_call(node) and not _has_doc_changed_guard(node):
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
