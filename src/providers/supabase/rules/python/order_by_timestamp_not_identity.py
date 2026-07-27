"""supabase-order-by-timestamp-not-identity

Parity with the JS rule: `.order("id", ...)` "works" only because a bigint
identity PK happens to be monotonic with insert order today. When the same
query already selects a purpose-built timestamp column (e.g. `created_at`),
order by that column instead of the surrogate key.

Same bottom-up chain walk as scope-queries-by-tenant-column.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import (
    call_report_loc,
    chain_object_call,
    is_supabase_table_call,
    is_timestamp_column_name,
    iter_calls_post_order,
    member_prop_name,
    parse_select_columns,
)

RULE_KEY = "supabase-order-by-timestamp-not-identity"


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []
    chain_states: dict[int, dict] = {}

    for node in iter_calls_post_order(tree):
        prop = member_prop_name(node)
        if not prop:
            continue

        obj_call = chain_object_call(node)

        if prop == "select" and obj_call is not None and is_supabase_table_call(obj_call):
            columns = parse_select_columns(node.args[0] if node.args else None)
            timestamp_columns = [c for c in columns if is_timestamp_column_name(c)]
            chain_states[id(node)] = {"timestamp_columns": timestamp_columns}
            continue

        state = chain_states.get(id(obj_call)) if obj_call is not None else None
        if state is None:
            continue

        if prop == "order":
            col_arg = node.args[0] if node.args else None
            order_column = col_arg.value if isinstance(col_arg, ast.Constant) else None
            if (
                isinstance(order_column, str)
                and order_column.lower() == "id"
                and state["timestamp_columns"]
            ):
                line, col = call_report_loc(node)
                out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

        chain_states[id(node)] = state

    return out
