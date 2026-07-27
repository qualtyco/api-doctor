"""supabase-unchecked-mutation-error

Parity with the JS rule, adapted for exception-based error handling: Python
`.execute()` raises `postgrest.exceptions.APIError` on failure instead of
resolving to `{ data, error }`, so simply *not* wrapping a mutation in
`try/except` is the safe default (the failure is visible — it propagates to
the caller/framework). The Python analogue of "never reads the returned
error field" is a `try/except` whose handler body is a no-op (`pass` /
`...`), which silently discards the failure instead. See
`utils.enclosing_try_noop_except`.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import (
    build_parent_map,
    call_report_loc,
    chain_has_method,
    enclosing_try_noop_except,
    is_supabase_mutation_kind,
)

RULE_KEY = "supabase-unchecked-mutation-error"

MUTATIONS = ("insert", "update", "delete", "upsert")


def _is_supabase_mutation_call(node: ast.AST | None) -> bool:
    return any(is_supabase_mutation_kind(node, kind) for kind in MUTATIONS)


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []
    parents = build_parent_map(tree)

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if not (isinstance(func, ast.Attribute) and func.attr == "execute"):
            continue
        mutation_call = func.value
        if not isinstance(mutation_call, ast.Call) or not _is_supabase_mutation_call(mutation_call):
            continue
        if chain_has_method(mutation_call, "throw_on_error"):
            continue
        if not enclosing_try_noop_except(parents, node):
            continue

        line, col = call_report_loc(node)
        out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
