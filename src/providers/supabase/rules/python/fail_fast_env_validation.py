"""supabase-fail-fast-env-validation

Parity with the JS rule: `create_client(url, key)` called with values that
trace back to `os.environ` with no presence check first raises the SDK's
own ("supabaseUrl is required." / "supabaseKey is required.") message
instead of one naming the actual env var to set.

Tracks (in source order, since guards precede the call they protect):
  - the local name `create_client` was imported as (`from supabase import
    create_client`)
  - which local variables were assigned directly from an env lookup
    (`os.environ.get("X")` / `os.getenv("X")` / `os.environ["X"]`)
  - which variables/env-names an `if not x: raise/return` (or `is None`)
    guard covers
then, at the factory call, flags any argument that resolves to an
env-sourced value with no matching guard.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))

RULE_KEY = "supabase-fail-fast-env-validation"


def _env_name(node: ast.AST | None) -> str | None:
    """Returns the env var name for `os.environ.get("X")`, `os.getenv("X")`, or `os.environ["X"]`."""
    if isinstance(node, ast.Call):
        func = node.func
        if isinstance(func, ast.Attribute) and func.attr == "get":
            base = func.value
            if isinstance(base, ast.Attribute) and base.attr == "environ" and _is_os(base.value):
                return _first_str_arg(node)
        if isinstance(func, ast.Attribute) and func.attr == "getenv" and _is_os(func.value):
            return _first_str_arg(node)
        if isinstance(func, ast.Name) and func.id == "getenv":
            return _first_str_arg(node)
        return None
    if isinstance(node, ast.Subscript):
        base = node.value
        if isinstance(base, ast.Attribute) and base.attr == "environ" and _is_os(base.value):
            key = node.slice
            if isinstance(key, ast.Constant) and isinstance(key.value, str):
                return key.value
        return None
    return None


def _is_os(node: ast.AST) -> bool:
    return isinstance(node, ast.Name) and node.id == "os"


def _first_str_arg(call: ast.Call) -> str | None:
    if call.args and isinstance(call.args[0], ast.Constant) and isinstance(call.args[0].value, str):
        return call.args[0].value
    return None


def _has_throw_or_return(stmts: list[ast.stmt]) -> bool:
    return any(isinstance(s, (ast.Raise, ast.Return)) for s in stmts)


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    factory_local_names: set[str] = set()
    env_var_of_variable: dict[str, str] = {}
    validated_var_names: set[str] = set()
    validated_env_names: set[str] = set()
    out: list[dict] = []

    def add_target(node: ast.AST | None) -> None:
        if isinstance(node, ast.Name):
            validated_var_names.add(node.id)
            return
        env_name = _env_name(node)
        if env_name:
            validated_env_names.add(env_name)

    def collect_guard_targets(node: ast.AST | None) -> None:
        if node is None:
            return
        if isinstance(node, ast.BoolOp) and isinstance(node.op, ast.Or):
            for v in node.values:
                collect_guard_targets(v)
            return
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
            add_target(node.operand)
            return
        if isinstance(node, ast.Compare) and len(node.ops) == 1:
            op = node.ops[0]
            if isinstance(op, (ast.Is, ast.Eq)):
                sides = [node.left, node.comparators[0]]

                def is_nullish(n: ast.AST) -> bool:
                    return isinstance(n, ast.Constant) and n.value is None

                target = next((s for s in sides if not is_nullish(s)), None)
                null_side = next((s for s in sides if is_nullish(s)), None)
                if target is not None and null_side is not None:
                    add_target(target)

    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module == "supabase":
            for alias in node.names:
                if alias.name == "create_client":
                    factory_local_names.add(alias.asname or alias.name)

        elif isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            env_name = _env_name(node.value)
            if env_name:
                env_var_of_variable[node.targets[0].id] = env_name

        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            env_name = _env_name(node.value)
            if env_name:
                env_var_of_variable[node.target.id] = env_name

        elif isinstance(node, ast.If):
            if _has_throw_or_return(node.body):
                collect_guard_targets(node.test)

    if not factory_local_names:
        return out

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if not (isinstance(func, ast.Name) and func.id in factory_local_names):
            continue

        missing: list[str] = []
        for arg in [*node.args, *[kw.value for kw in node.keywords if kw.arg in ("supabase_url", "supabase_key")]]:
            env_name: str | None = None
            is_validated: bool

            if isinstance(arg, ast.Name):
                env_name = env_var_of_variable.get(arg.id)
                if not env_name:
                    continue
                is_validated = arg.id in validated_var_names
            else:
                env_name = _env_name(arg)
                if not env_name:
                    continue
                is_validated = env_name in validated_env_names

            if not is_validated:
                missing.append(env_name)

        if missing:
            line = getattr(node, "lineno", 1) or 1
            col = (getattr(node, "col_offset", 0) or 0) + 1
            out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
