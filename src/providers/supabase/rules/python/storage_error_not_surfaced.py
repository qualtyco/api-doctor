"""supabase-storage-error-not-surfaced

Parity with the JS rule, adapted for exceptions: Storage `.upload(...)`
raises on failure (there is no `.execute()` terminal — the call returns or
raises immediately) instead of resolving to `{ error }`. The Python
foot-gun is the same shape as the other error-checking rules: a
`try/except` whose handler is a no-op (`pass`/`...`) lets the caller fall
through and keep using a path/URL that was never actually uploaded.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import attribute_chain_parts, build_parent_map, call_report_loc, enclosing_try_noop_except

RULE_KEY = "supabase-storage-error-not-surfaced"


def _is_storage_upload_call(node: ast.AST | None) -> bool:
    if not isinstance(node, ast.Call):
        return False
    func = node.func
    if not (isinstance(func, ast.Attribute) and func.attr == "upload"):
        return False
    # <base>.storage.from_("bucket").upload(...) — walk down through the
    # `.from_(...)` call to the `.storage` attribute access.
    base = func.value
    if not isinstance(base, ast.Call):
        return False
    base_func = base.func
    if not (isinstance(base_func, ast.Attribute) and base_func.attr in ("from_", "from_bucket")):
        return False
    return "storage" in attribute_chain_parts(base_func.value)


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []
    parents = build_parent_map(tree)

    for node in ast.walk(tree):
        if not _is_storage_upload_call(node):
            continue
        if not enclosing_try_noop_except(parents, node):
            continue

        line, col = call_report_loc(node)
        out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
