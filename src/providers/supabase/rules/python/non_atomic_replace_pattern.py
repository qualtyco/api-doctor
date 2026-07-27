"""supabase-non-atomic-replace-pattern

Parity with the JS rule, adapted for exceptions: sequential delete-then-insert
calls on the same table are not transactional in either SDK. In Python the
data-loss risk is specifically a *swallowed* exception on either step (see
`unchecked_mutation_error.py`) — an unwrapped call raises visibly and stops
execution, which is loud but not silent; a `try/except: pass` around either
step (commonly the whole delete+insert sequence sharing one wrapper) is what
lets a failed insert after a successful delete disappear without a trace.
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
    enclosing_function,
    enclosing_try_noop_except,
    from_table_name,
    is_supabase_mutation_kind,
)

RULE_KEY = "supabase-non-atomic-replace-pattern"


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []
    parents = build_parent_map(tree)
    # function node -> list of (node, table, kind, unchecked)
    mutations_by_function: dict[ast.AST, list[tuple]] = {}

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if not (isinstance(func, ast.Attribute) and func.attr == "execute"):
            continue
        mutation_call = func.value
        if not isinstance(mutation_call, ast.Call):
            continue

        kind = None
        if is_supabase_mutation_kind(mutation_call, "delete"):
            kind = "delete"
        elif is_supabase_mutation_kind(mutation_call, "insert"):
            kind = "insert"
        if kind is None:
            continue

        fn = enclosing_function(parents, node)
        if fn is None:
            continue

        unchecked = enclosing_try_noop_except(parents, node)
        table = from_table_name(mutation_call)
        mutations_by_function.setdefault(fn, []).append((node, table, kind, unchecked))

    for fn, sites in mutations_by_function.items():
        deletes = [s for s in sites if s[2] == "delete"]
        inserts = [s for s in sites if s[2] == "insert"]
        if not deletes or not inserts:
            continue

        unchecked_delete = any(s[3] for s in deletes)
        unchecked_insert = any(s[3] for s in inserts)
        if not (unchecked_delete and unchecked_insert):
            continue

        same_table = any(
            d[1] and i[1] and d[1] == i[1] for d in deletes for i in inserts
        )
        if not same_table:
            continue

        report_node = inserts[0][0]
        line, col = call_report_loc(report_node)
        out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
