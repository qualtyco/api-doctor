"""tiptap-prefer-table-kit (python analog, correctness)

The JS rule flags importing individual `@tiptap/extension-table-*` packages
instead of `TableKit`. There is no Python equivalent import, but Python
backends that drive which frontend Tiptap extensions load (e.g. a
feature-flag list or extension registry serialized as a Python list/dict of
npm package names) reproduce the exact same "un-bundled" configuration. This
flags 2+ distinct individual table package name string literals appearing
anywhere in a Python file (list/dict/set literal), the same threshold the JS
rule uses for imports.

Flags:
    TABLE_EXTENSIONS = [
        "@tiptap/extension-table-row",
        "@tiptap/extension-table-cell",
    ]

Does NOT flag a single individual package reference, or `@tiptap/extension-table` (TableKit).
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))

from utils import INDIVIDUAL_TABLE_PACKAGES, loc  # noqa: E402

RULE_KEY = "tiptap-prefer-table-kit"


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    matches: list[tuple[ast.Constant, str]] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and node.value in INDIVIDUAL_TABLE_PACKAGES:
            matches.append((node, node.value))

    distinct = {value for _, value in matches}
    if len(distinct) < 2:
        return []

    out: list[dict] = []
    for node, _ in matches:
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
