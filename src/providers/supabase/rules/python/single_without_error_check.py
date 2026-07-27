"""supabase-single-without-error-check

Parity with the JS rule: `.single()` raises on zero/multiple rows (PGRST116)
just like any other Postgrest failure in Python — see
`unchecked_mutation_error.py` for why a no-op `except` (not merely "no
try/except") is what silently discards that failure here.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import build_parent_map, call_report_loc, chain_has_method, enclosing_try_noop_except

RULE_KEY = "supabase-single-without-error-check"


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []
    parents = build_parent_map(tree)

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if not (isinstance(func, ast.Attribute) and func.attr == "execute"):
            continue
        query_call = func.value
        if not isinstance(query_call, ast.Call) or not chain_has_method(query_call, "single"):
            continue
        if chain_has_method(query_call, "throw_on_error"):
            continue
        if not enclosing_try_noop_except(parents, node):
            continue

        line, col = call_report_loc(node)
        out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
