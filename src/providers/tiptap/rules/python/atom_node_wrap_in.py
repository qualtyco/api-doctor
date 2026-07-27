"""tiptap-atom-node-wrap-in (python analog, correctness)

Ports the JS rule's config-driven detection: a dict literal representing a
node definition with `atom: True` and a `name`, combined with a `wrap_in(...)`
/ `wrapIn(...)` call elsewhere in the file using that same name. Applies to
Python code that mirrors Tiptap node registration as data (e.g. a shared
schema file, or a server-side command dispatcher reimplementing editor
commands) — `wrap_in` on an atom node type always returns false in
ProseMirror, and a Python reimplementation of the same command semantics
would carry the identical dead branch.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))

from utils import (  # noqa: E402
    dict_get_any,
    func_or_method_name,
    is_true_literal,
    iter_dicts,
    literal_str,
    loc,
)

RULE_KEY = "tiptap-atom-node-wrap-in"


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    atom_node_names: set[str] = set()
    for d in iter_dicts(tree):
        if is_true_literal(dict_get_any(d, "atom")):
            name = literal_str(dict_get_any(d, "name"))
            if name:
                atom_node_names.add(name)

    if not atom_node_names:
        return []

    out: list[dict] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        if func_or_method_name(node.func) not in {"wrapIn", "wrap_in"}:
            continue
        if not node.args:
            continue
        name = literal_str(node.args[0])
        if name and name in atom_node_names:
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
