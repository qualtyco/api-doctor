"""supabase-scope-queries-by-tenant-column

Parity with the JS rule: a `.table(x).select(...)` query that selects a
tenant/ownership-style column (e.g. `session_id`, `user_id`) but never
filters by it (`.eq()`, `.match()`, `.filter()`) before `.execute()`.

Walks each query chain bottom-up (`iter_calls_post_order`, the Python
analogue of ESLint's `CallExpression:exit`) so inner calls are visited
before the calls built on top of them, threading chain state outward
through `chain_object_call`. The trailing `.execute()` call carries no
special handling — it just isn't `select`/`eq`/`match`/`filter`, so it's a
no-op link that state passes through untouched.
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
    is_tenant_column_name,
    iter_calls_post_order,
    member_prop_name,
    parse_select_columns,
)

RULE_KEY = "supabase-scope-queries-by-tenant-column"


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []
    # node id -> {"select_node": Call, "tenant_columns": [...], "filtered_columns": set}
    chain_states: dict[int, dict] = {}
    select_states: list[dict] = []

    def record_filtered_column(state: dict, name) -> None:
        state["filtered_columns"].add(name if isinstance(name, str) else "*")

    for node in iter_calls_post_order(tree):
        prop = member_prop_name(node)
        if not prop:
            continue

        obj_call = chain_object_call(node)

        if prop == "select" and obj_call is not None and is_supabase_table_call(obj_call):
            columns = parse_select_columns(node.args[0] if node.args else None)
            tenant_columns = [c for c in columns if is_tenant_column_name(c)]
            if not tenant_columns:
                continue
            state = {"select_node": node, "tenant_columns": tenant_columns, "filtered_columns": set()}
            chain_states[id(node)] = state
            select_states.append(state)
            continue

        state = chain_states.get(id(obj_call)) if obj_call is not None else None
        if state is None:
            continue

        if prop in ("eq", "filter"):
            col_arg = node.args[0] if node.args else None
            record_filtered_column(state, col_arg.value if isinstance(col_arg, ast.Constant) else None)
        elif prop == "match":
            obj_arg = node.args[0] if node.args else None
            if isinstance(obj_arg, ast.Dict):
                for k in obj_arg.keys:
                    name = k.value if isinstance(k, ast.Constant) else None
                    record_filtered_column(state, name)
            elif len(node.keywords) > 0:
                for kw in node.keywords:
                    record_filtered_column(state, kw.arg)
            else:
                record_filtered_column(state, None)

        chain_states[id(node)] = state

    for state in select_states:
        if "*" in state["filtered_columns"]:
            continue
        missing = next((c for c in state["tenant_columns"] if c not in state["filtered_columns"]), None)
        if missing:
            node = state["select_node"]
            line, col = call_report_loc(node)
            out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
