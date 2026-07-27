"""resend-batch-size-not-enforced

Parity with the JS rule: only flag `Batch.send(<name>)` when the argument is a
variable (not a literal list) and the enclosing function has no `len(name)`
comparison. Calls inside loops are skipped (chunking pattern).
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import is_resend_batch_send

RULE_KEY = "resend-batch-size-not-enforced"


def _enclosing_function(tree: ast.AST, node: ast.AST) -> ast.AST | None:
    parents: dict[ast.AST, ast.AST] = {}
    for parent in ast.walk(tree):
        for child in ast.iter_child_nodes(parent):
            parents[child] = parent
    cur: ast.AST | None = node
    while cur is not None:
        if isinstance(cur, (ast.FunctionDef, ast.AsyncFunctionDef)):
            return cur
        cur = parents.get(cur)
    return None


def _inside_loop(tree: ast.AST, node: ast.AST) -> bool:
    parents: dict[ast.AST, ast.AST] = {}
    for parent in ast.walk(tree):
        for child in ast.iter_child_nodes(parent):
            parents[child] = parent
    cur: ast.AST | None = node
    while cur is not None:
        if isinstance(cur, (ast.For, ast.AsyncFor, ast.While)):
            return True
        cur = parents.get(cur)
    return False


def _len_of_name(node: ast.AST) -> str | None:
    """Return name if node is len(<name>), else None."""
    if not isinstance(node, ast.Call):
        return None
    func = node.func
    if not isinstance(func, ast.Name) or func.id != "len":
        return None
    if len(node.args) != 1 or not isinstance(node.args[0], ast.Name):
        return None
    return node.args[0].id


def _length_guarded_names(fn: ast.AST) -> set[str]:
    names: set[str] = set()
    for node in ast.walk(fn):
        if not isinstance(node, ast.Compare):
            continue
        # len(x) <op> <num>  or  <num> <op> len(x)
        candidates = [node.left, *[c for c in node.comparators]]
        for side in candidates:
            name = _len_of_name(side)
            if name:
                names.add(name)
    return names


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not is_resend_batch_send(node):
            continue
        if not node.args:
            continue
        arg = node.args[0]
        # Literal lists / comprehensions: size known or built inline — out of scope (JS parity).
        if not isinstance(arg, ast.Name):
            continue
        if _inside_loop(tree, node):
            continue
        enclosing = _enclosing_function(tree, node)
        scope = enclosing if enclosing is not None else tree
        if arg.id in _length_guarded_names(scope):
            continue
        line = getattr(node, "lineno", 1) or 1
        col = (getattr(node, "col_offset", 0) or 0) + 1
        out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})
    return out
