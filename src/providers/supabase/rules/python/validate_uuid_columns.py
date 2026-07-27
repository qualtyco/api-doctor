"""supabase-validate-uuid-columns

Parity with the JS rule (`typeof x === "string"` -> Python `isinstance(x,
str)`): a value validated only with `isinstance(x, str)` before being
inserted/upserted into a uuid-typed column passes for any non-UUID string,
then fails at the database with a Postgres type-cast error.

UUID-shape validation is recognized as either:
  - a regex `.match()`/`.fullmatch()`/`.search()` (or `re.match(pattern,
    x)`) whose pattern looks UUID-shaped, or
  - `uuid.UUID(x)` — the idiomatic Python way to validate UUID shape
    (raises `ValueError` on a malformed string), which has no direct JS SDK
    analogue but is overwhelmingly the common real-world pattern.
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
    is_tenant_column_name,
    isinstance_str_check_target,
    member_prop_name,
    regex_source_looks_uuid_shaped,
    resolve_dict_value_name,
)

RULE_KEY = "supabase-validate-uuid-columns"

_REGEX_TEST_METHODS = ("match", "fullmatch", "search")


def _regex_pattern_from_node(node: ast.AST | None, regex_var_patterns: dict[str, str]) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.Name):
        return regex_var_patterns.get(node.id)
    return None


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []
    # name -> {"typeof_only": bool, "uuid_checked": bool}
    validations: dict[str, dict] = {}
    regex_var_patterns: dict[str, str] = {}

    def mark(name: str, key: str) -> None:
        v = validations.setdefault(name, {"typeof_only": False, "uuid_checked": False})
        v[key] = True

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            if isinstance(node.value, ast.Call):
                fn = node.value.func
                if isinstance(fn, ast.Attribute) and fn.attr == "compile" and isinstance(fn.value, ast.Name) and fn.value.id == "re":
                    if node.value.args and isinstance(node.value.args[0], ast.Constant) and isinstance(node.value.args[0].value, str):
                        regex_var_patterns[node.targets[0].id] = node.value.args[0].value

    for node in ast.walk(tree):
        target = isinstance_str_check_target(node)
        if target:
            mark(target, "typeof_only")
            continue

        if not isinstance(node, ast.Call):
            continue

        func = node.func
        # <pattern>.match(x) / re.match(pattern, x) / <compiled>.fullmatch(x) / .search(x)
        if isinstance(func, ast.Attribute) and func.attr in _REGEX_TEST_METHODS:
            obj = func.value
            if isinstance(obj, ast.Name) and obj.id == "re":
                pattern = _regex_pattern_from_node(node.args[0] if node.args else None, regex_var_patterns)
                target_arg = node.args[1] if len(node.args) > 1 else None
            else:
                pattern = None
                if isinstance(obj, ast.Constant) and isinstance(obj.value, str):
                    pattern = obj.value
                elif isinstance(obj, ast.Name):
                    pattern = regex_var_patterns.get(obj.id)
                target_arg = node.args[0] if node.args else None

            if pattern and regex_source_looks_uuid_shaped(pattern) and isinstance(target_arg, ast.Name):
                mark(target_arg.id, "uuid_checked")
            continue

        # uuid.UUID(x)
        if isinstance(func, ast.Attribute) and func.attr == "UUID" and isinstance(func.value, ast.Name) and func.value.id == "uuid":
            if node.args and isinstance(node.args[0], ast.Name):
                mark(node.args[0].id, "uuid_checked")
            continue
        if isinstance(func, ast.Name) and func.id == "UUID" and node.args and isinstance(node.args[0], ast.Name):
            mark(node.args[0].id, "uuid_checked")
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

        for k, v in zip(arg.keys, arg.values):
            key_name = k.value if isinstance(k, ast.Constant) and isinstance(k.value, str) else None
            if not key_name or not is_tenant_column_name(key_name):
                continue

            value_name = resolve_dict_value_name(v)
            if not value_name:
                continue

            validation = validations.get(value_name)
            if validation and validation["typeof_only"] and not validation["uuid_checked"]:
                line = getattr(v, "lineno", getattr(node, "lineno", 1)) or 1
                col = (getattr(v, "col_offset", getattr(node, "col_offset", 0)) or 0) + 1
                out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
