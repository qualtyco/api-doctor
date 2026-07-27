"""tiptap-drop-handler-pos-precedence (python analog, correctness)

Python has no `??` operator, but `or` has the same "binds looser than
arithmetic" precedence problem: `pos or 0 - 1` parses as `pos or (0 - 1)`, not
`(pos or 0) - 1`. A Python drop handler ported from (or mirroring) a
ProseMirror `posAtCoords` callback — e.g. a server-side collaborative editor
backend computing an insert position — reproduces the exact same off-by-one
bug when translated idiomatically to `or`.

AST shape of `pos or 0 - 1`:
    BoolOp(Or, values=[Name('pos'), BinOp(Sub, Constant(0), Constant(1))])

Flags:
    pos = coords.get("pos") or 0 - 1

Does NOT flag:
    pos = (coords.get("pos") or 0) - 1
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))

from utils import loc  # noqa: E402

RULE_KEY = "tiptap-drop-handler-pos-precedence"


def _is_zero_minus_one(node: ast.AST | None) -> bool:
    return (
        isinstance(node, ast.BinOp)
        and isinstance(node.op, ast.Sub)
        and isinstance(node.left, ast.Constant)
        and node.left.value == 0
        and isinstance(node.right, ast.Constant)
        and node.right.value == 1
    )


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []

    for node in ast.walk(tree):
        if not isinstance(node, ast.BoolOp) or not isinstance(node.op, ast.Or):
            continue
        if not node.values or not _is_zero_minus_one(node.values[-1]):
            continue
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
