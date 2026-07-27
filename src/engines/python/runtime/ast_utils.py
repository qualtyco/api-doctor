"""Shared AST helpers for Python provider rules (stdlib only)."""

from __future__ import annotations

import ast
import re
from typing import Iterator


def iter_nodes(tree: ast.AST) -> Iterator[ast.AST]:
    yield from ast.walk(tree)


def string_constants(node: ast.AST) -> Iterator[tuple[ast.AST, str]]:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        yield node, node.value
    elif isinstance(node, ast.JoinedStr):
        parts: list[str] = []
        for v in node.values:
            if isinstance(v, ast.Constant) and isinstance(v.value, str):
                parts.append(v.value)
        if parts:
            yield node, "".join(parts)


def loc(node: ast.AST) -> tuple[int, int, int | None, int | None]:
    line = getattr(node, "lineno", 1) or 1
    col = (getattr(node, "col_offset", 0) or 0) + 1
    end_line = getattr(node, "end_lineno", None)
    end_col = getattr(node, "end_col_offset", None)
    if end_col is not None:
        end_col = end_col + 1
    return line, col, end_line, end_col


def imports_module(tree: ast.AST, module: str) -> bool:
    for node in iter_nodes(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == module or alias.name.startswith(module + "."):
                    return True
        elif isinstance(node, ast.ImportFrom):
            if node.module == module or (node.module and node.module.startswith(module + ".")):
                return True
    return False


def attr_chain(node: ast.AST) -> list[str] | None:
    if isinstance(node, ast.Call):
        return attr_chain(node.func)
    parts: list[str] = []
    cur: ast.AST | None = node
    while isinstance(cur, ast.Attribute):
        parts.append(cur.attr)
        cur = cur.value
    if isinstance(cur, ast.Name):
        parts.append(cur.id)
        parts.reverse()
        return parts
    return None


def call_ends_with(node: ast.Call, *suffix: str) -> bool:
    chain = attr_chain(node)
    if not chain or len(chain) < len(suffix):
        return False
    return tuple(chain[-len(suffix) :]) == suffix


def kwarg_names(call: ast.Call) -> set[str]:
    return {k.arg for k in call.keywords if k.arg}


def dict_keys_from_call_arg(call: ast.Call, index: int = 0) -> set[str] | None:
    if index >= len(call.args):
        return None
    arg = call.args[index]
    if not isinstance(arg, ast.Dict):
        return None
    keys: set[str] = set()
    for k in arg.keys:
        if isinstance(k, ast.Constant) and isinstance(k.value, str):
            keys.add(k.value)
    return keys


def has_key_in_call(call: ast.Call, key: str) -> bool:
    if key in kwarg_names(call):
        return True
    keys = dict_keys_from_call_arg(call, 0)
    if keys is not None and key in keys:
        return True
    keys2 = dict_keys_from_call_arg(call, 1)
    if keys2 is not None and key in keys2:
        return True
    return False


RESEND_KEY_RE = re.compile(r"\bre_[A-Za-z0-9_]+")


def enclosing_scope_map(tree: ast.AST) -> dict[int, ast.AST]:
    """
    Maps id(node) -> nearest enclosing scope (Module, or the closest
    Function/AsyncFunctionDef/Lambda). Mirrors a live scope-stack traversal
    (as ESLint visitors do) without needing an event-based visitor: every
    node's nearest enclosing function is computed in one top-down pass.
    """
    scope_of: dict[int, ast.AST] = {}

    def visit(node: ast.AST, scope: ast.AST) -> None:
        scope_of[id(node)] = scope
        new_scope = node if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)) else scope
        for child in ast.iter_child_nodes(node):
            visit(child, new_scope)

    visit(tree, tree)
    return scope_of
