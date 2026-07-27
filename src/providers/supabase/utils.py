"""Shared AST helpers for Supabase Python rules.

Mirrors ``utils.ts`` where the concept transfers. Two structural differences
from the JS SDK shape everything below:

  - Query chains are built with ``.table("x")`` (or its alias ``.from_("x")``)
    instead of ``.from("x")``, and every chain ends in a terminal
    ``.execute()`` call (there is no implicit `await` on the builder itself).
  - ``.execute()`` *raises* (``postgrest.exceptions.APIError`` /
    ``StorageApiError``) on failure instead of resolving to ``{ data, error
    }``. The only way a Supabase failure becomes silent in Python is a
    ``try/except`` whose handler body is a no-op (``pass`` / ``...``) — that
    is the Python analogue of "never reads the returned error field" in JS,
    and is what the error-checking rules (unchecked-mutation-error,
    single-without-error-check, non-atomic-replace-pattern,
    storage-error-not-surfaced) key off of via `enclosing_noop_except`.
"""

from __future__ import annotations

import ast
import re

_TABLE_METHODS = frozenset({"table", "from_", "from_table"})


def call_report_loc(node: ast.Call) -> tuple[int, int]:
    """Best-effort (line, column) for a specific call within a chain.

    CPython gives every Call/Attribute node in a `.a().b().c()` chain the
    *same* `lineno`/`col_offset` — the start of the whole chain (`a`) — so
    reporting a diagnostic at `.b(...)`'s own position via `node.lineno`
    silently points at (and, worse, collides with) wherever the chain
    started, especially once the chain wraps multiple lines. `func.end_*`
    is the one position CPython records per call in the chain (just after
    the attribute name), so it is used here to recover a per-call location
    instead. Falls back to the call's own position for a bare `name(...)`
    call, which has no such ambiguity.
    """
    func = node.func
    if isinstance(func, ast.Attribute) and func.end_lineno is not None and func.end_col_offset is not None:
        col = func.end_col_offset - len(func.attr) + 1
        return func.end_lineno, max(col, 1)
    line = getattr(node, "lineno", 1) or 1
    col = (getattr(node, "col_offset", 0) or 0) + 1
    return line, col


def member_prop_name(call: ast.Call) -> str | None:
    """Attribute name of a call's callee, e.g. `x.select(...)` -> 'select'."""
    func = call.func
    if isinstance(func, ast.Attribute):
        return func.attr
    return None


def chain_object_call(call: ast.Call) -> ast.Call | None:
    """The Call this call is chained onto (`<this>.method()`), or None."""
    func = call.func
    if not isinstance(func, ast.Attribute):
        return None
    return func.value if isinstance(func.value, ast.Call) else None


def iter_calls_post_order(node: ast.AST):
    """Yield ast.Call nodes depth-first, children before parents.

    Mirrors an ESLint `CallExpression:exit` visitor: a `.eq()` call chained
    on top of `.select()` is yielded after the `.select()` call it wraps, so
    chain state recorded at the inner call is already present when the
    outer call is processed.
    """
    for child in ast.iter_child_nodes(node):
        yield from iter_calls_post_order(child)
    if isinstance(node, ast.Call):
        yield node


def parse_select_columns(arg: ast.AST | None) -> list[str]:
    """Splits a `.select("a, b, c")` string literal into trimmed column names."""
    if not isinstance(arg, ast.Constant) or not isinstance(arg.value, str):
        return []
    return [c.strip() for c in arg.value.split(",") if c.strip()]


def is_tenant_column_name(name: str) -> bool:
    """True for column names that look like a tenant/ownership key, e.g. `user_id` (not bare `id`)."""
    return bool(re.match(r"^[a-z][a-z0-9]*_id$", name, re.I)) and name.lower() != "id"


def is_timestamp_column_name(name: str) -> bool:
    """True for column names that look like a timestamp, e.g. `created_at`."""
    return bool(re.match(r"^[a-z][a-z0-9]*_at$", name, re.I))


def is_supabase_table_call(call: ast.Call) -> bool:
    """True when `node` is the `.table("x")` / `.from_("x")` base of a query chain."""
    return member_prop_name(call) in _TABLE_METHODS


def from_table_name(node: ast.AST | None) -> str | None:
    """Returns the table name from a `.table("x")`/`.from_("x")` call anywhere in the chain."""
    current = node
    while isinstance(current, ast.Call):
        if is_supabase_table_call(current):
            arg = current.args[0] if current.args else None
            if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                return arg.value
            return None
        current = chain_object_call(current)
    return None


def chain_has_method(node: ast.AST | None, method: str) -> bool:
    """True when a chained Supabase call includes `.method()` anywhere on the way down."""
    current = node
    while isinstance(current, ast.Call):
        if member_prop_name(current) == method:
            return True
        current = chain_object_call(current)
    return False


def is_supabase_mutation_kind(node: ast.AST | None, kind: str) -> bool:
    if not isinstance(node, ast.Call) or not chain_has_method(node, kind):
        return False
    current: ast.AST | None = node
    while isinstance(current, ast.Call):
        if is_supabase_table_call(current):
            return True
        current = chain_object_call(current)
    return False


_USER_METADATA_AUTHZ_KEYS = frozenset(
    {"role", "roles", "admin", "is_admin", "permission", "permissions"}
)


def attribute_chain_parts(node: ast.AST) -> list[str]:
    """Flattens an Attribute chain into name parts, e.g. `a.b.c` -> ['a', 'b', 'c']."""
    parts: list[str] = []
    current: ast.AST | None = node
    while isinstance(current, ast.Attribute):
        parts.append(current.attr)
        current = current.value
    if isinstance(current, ast.Name):
        parts.append(current.id)
    parts.reverse()
    return parts


def is_user_metadata_authz_read(node: ast.AST) -> bool:
    """True when `node` reads an auth-sensitive key from `user_metadata`.

    Covers `x.user_metadata["role"]` (Subscript) and `x.user_metadata.get("role")` (Call).
    """
    if isinstance(node, ast.Subscript):
        parts = attribute_chain_parts(node.value)
        if not parts or parts[-1] != "user_metadata":
            return False
        key = _slice_string(node.slice)
        return key is not None and key in _USER_METADATA_AUTHZ_KEYS

    if isinstance(node, ast.Call):
        func = node.func
        if not isinstance(func, ast.Attribute) or func.attr != "get":
            return False
        parts = attribute_chain_parts(func.value)
        if not parts or parts[-1] != "user_metadata":
            return False
        if not node.args or not isinstance(node.args[0], ast.Constant):
            return False
        return node.args[0].value in _USER_METADATA_AUTHZ_KEYS

    return False


def _slice_string(slice_node: ast.AST) -> str | None:
    node = slice_node
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def dict_get(d: ast.Dict, key: str) -> ast.AST | None:
    for k, v in zip(d.keys, d.values):
        if isinstance(k, ast.Constant) and k.value == key:
            return v
    return None


def find_auth_data_payload(args: list[ast.AST]) -> ast.Dict | None:
    """Locates the `data` dict nested under `options` (or top-level) in a sign_up/update_user call."""
    for arg in args:
        if not isinstance(arg, ast.Dict):
            continue
        data = dict_get(arg, "data")
        if isinstance(data, ast.Dict):
            return data
        options = dict_get(arg, "options")
        if isinstance(options, ast.Dict):
            opts_data = dict_get(options, "data")
            if isinstance(opts_data, ast.Dict):
                return opts_data
    return None


def dict_has_authz_key(d: ast.Dict | None) -> bool:
    if d is None:
        return False
    for k in d.keys:
        if isinstance(k, ast.Constant) and isinstance(k.value, str) and k.value in _USER_METADATA_AUTHZ_KEYS:
            return True
    return False


def is_auth_user_metadata_write(call: ast.Call) -> bool:
    prop = member_prop_name(call)
    if prop not in ("sign_up", "update_user"):
        return False
    return dict_has_authz_key(find_auth_data_payload(call.args))


def isinstance_str_check_target(node: ast.AST) -> str | None:
    """If `node` is `isinstance(<name>, str)` (optionally negated), returns `<name>`."""
    call = node
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
        call = node.operand
    if not isinstance(call, ast.Call):
        return None
    func = call.func
    if not (isinstance(func, ast.Name) and func.id == "isinstance"):
        return None
    if len(call.args) != 2:
        return None
    target, typ = call.args
    if not isinstance(target, ast.Name):
        return None
    if isinstance(typ, ast.Name) and typ.id == "str":
        return target.id
    return None


def regex_source_looks_uuid_shaped(pattern: str) -> bool:
    return bool(re.search(r"[0-9a-f]{2,}", pattern, re.I)) and "-" in pattern


def resolve_dict_value_name(value: ast.AST | None) -> str | None:
    """Resolves the source identifier backing a dict value: a bare Name, or
    one guarded by `x or None` / `x or default` (left side is what was validated)."""
    if isinstance(value, ast.Name):
        return value.id
    if isinstance(value, ast.BoolOp) and isinstance(value.op, ast.Or) and value.values:
        first = value.values[0]
        if isinstance(first, ast.Name):
            return first.id
    return None


def length_cap_target(node: ast.AST) -> str | None:
    """If `node` is `len(<name>) > N` / `len(<name>) >= N` (either operand order), returns `<name>`."""
    if not isinstance(node, ast.Compare) or len(node.ops) != 1:
        return None
    op = node.ops[0]
    if not isinstance(op, (ast.Gt, ast.GtE)):
        return None
    left = node.left
    right = node.comparators[0]
    if _is_len_of_name(left) and isinstance(right, ast.Constant) and isinstance(right.value, (int, float)):
        return _len_arg_name(left)
    return None


def _is_len_of_name(node: ast.AST) -> bool:
    return (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "len"
        and len(node.args) == 1
        and isinstance(node.args[0], ast.Name)
    )


def _len_arg_name(node: ast.Call) -> str | None:
    arg = node.args[0]
    return arg.id if isinstance(arg, ast.Name) else None


def build_parent_map(tree: ast.AST) -> dict[ast.AST, ast.AST]:
    """Builds a child->parent map for one tree. Callers should build this
    once per `check()` invocation and pass it around rather than rebuilding
    it per-node (trees are not cached across calls since a fresh tree is
    parsed per file by the runtime)."""
    parents: dict[ast.AST, ast.AST] = {}
    for parent in ast.walk(tree):
        for child in ast.iter_child_nodes(parent):
            parents[child] = parent
    return parents


def enclosing_try_noop_except(parents: dict[ast.AST, ast.AST], target: ast.AST) -> bool:
    """True when `target` sits inside a `try` block whose matching `except`
    handler is a no-op (`pass` / `...` only) — the Python shape of "the
    error was never actually read", since `.execute()` otherwise raises and
    the failure is visible to the caller/framework by default."""
    cur: ast.AST | None = target
    while cur is not None:
        parent = parents.get(cur)
        if isinstance(parent, ast.Try) and cur in parent.body:
            if parent.handlers and all(_is_noop_except_body(h) for h in parent.handlers):
                return True
        cur = parent
    return False


def _is_noop_except_body(handler: ast.ExceptHandler) -> bool:
    def is_noop_stmt(s: ast.stmt) -> bool:
        if isinstance(s, ast.Pass):
            return True
        if isinstance(s, ast.Expr) and isinstance(s.value, ast.Constant) and s.value.value is Ellipsis:
            return True
        return False

    return all(is_noop_stmt(s) for s in handler.body)


def enclosing_function(parents: dict[ast.AST, ast.AST], node: ast.AST) -> ast.AST | None:
    cur: ast.AST | None = node
    while cur is not None:
        if isinstance(cur, (ast.FunctionDef, ast.AsyncFunctionDef)):
            return cur
        cur = parents.get(cur)
    return None


def enclosing_loop(parents: dict[ast.AST, ast.AST], node: ast.AST) -> bool:
    cur: ast.AST | None = node
    while cur is not None:
        if isinstance(cur, (ast.For, ast.AsyncFor, ast.While)):
            return True
        cur = parents.get(cur)
    return False
