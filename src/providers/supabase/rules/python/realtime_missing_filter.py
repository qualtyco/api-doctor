"""supabase-realtime-missing-filter

Parity with the JS rule: a Realtime `.on_postgres_changes(...)` call with no
`filter=` kwarg notifies this client on every matching row change for the
table. Often a mistake for per-user feeds; can be intentional for admin/global
views (severity is warning).
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import call_report_loc, member_prop_name

RULE_KEY = "supabase-realtime-missing-filter"


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or member_prop_name(node) != "on_postgres_changes":
            continue
        has_filter = any(kw.arg == "filter" for kw in node.keywords)
        if has_filter:
            continue
        line, col = call_report_loc(node)
        out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})
    return out
