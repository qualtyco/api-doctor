"""supabase-consistent-input-length-limits

Parity with the JS rule: when several string fields inserted together are
validated with an `isinstance(x, str)` check, and some of them are also
capped with `len(x) > N`/`len(x) >= N` while at least one sibling is not,
the uncapped field is usually the one that was forgotten.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import (
    chain_object_call,
    is_supabase_table_call,
    isinstance_str_check_target,
    length_cap_target,
    member_prop_name,
    resolve_dict_value_name,
)

RULE_KEY = "supabase-consistent-input-length-limits"


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []
    # name -> {"typeof_checked": bool, "has_length_cap": bool}
    validations: dict[str, dict] = {}

    def mark(name: str, key: str) -> None:
        v = validations.setdefault(name, {"typeof_checked": False, "has_length_cap": False})
        v[key] = True

    for node in ast.walk(tree):
        target = isinstance_str_check_target(node)
        if target:
            mark(target, "typeof_checked")

        length_target = length_cap_target(node) if isinstance(node, ast.Compare) else None
        if length_target:
            mark(length_target, "has_length_cap")

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        prop = member_prop_name(node)
        if prop not in ("insert", "upsert"):
            continue
        obj_call = chain_object_call(node)
        if not obj_call or not is_supabase_table_call(obj_call):
            continue

        arg = node.args[0] if node.args else None
        if not isinstance(arg, ast.Dict):
            continue

        string_fields: list[tuple[ast.AST, str, str]] = []
        for k, v in zip(arg.keys, arg.values):
            field = k.value if isinstance(k, ast.Constant) and isinstance(k.value, str) else None
            if field is None:
                continue
            var_name = resolve_dict_value_name(v)
            if not var_name:
                continue
            validation = validations.get(var_name)
            if validation and validation["typeof_checked"]:
                string_fields.append((v, field, var_name))

        capped = [f for f in string_fields if validations.get(f[2], {}).get("has_length_cap")]
        uncapped = [f for f in string_fields if not validations.get(f[2], {}).get("has_length_cap")]
        if not capped or not uncapped:
            continue

        for value_node, field, _var_name in uncapped:
            line = getattr(value_node, "lineno", getattr(node, "lineno", 1)) or 1
            col = (getattr(value_node, "col_offset", getattr(node, "col_offset", 0)) or 0) + 1
            out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
