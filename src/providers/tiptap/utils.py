"""
Shared AST helpers for Tiptap Python rules.

Tiptap is a JS/ProseMirror editor with no real Python SDK. These rules look
for *analogous* patterns in Python source — dict-literal configs that mirror
a Tiptap extension descriptor (parseHTML/renderHTML, addAttributes, atom),
Python functions that reimplement a ProseMirror-style appendTransaction hook
(e.g. a collaboration/CRDT backend), and generic script-injection /
hardcoded-secret patterns that show up wherever Python code emits HTML that
embeds a Tiptap CDN script or collaboration URL. See ANALYSIS.md under
validation/python/tiptap/ for the full rationale per rule.
"""

from __future__ import annotations

import ast
from typing import Iterable

from ast_utils import attr_chain, loc, string_constants  # noqa: F401 — re-exported

# Key names are matched in both their JS (camelCase) and Pythonic (snake_case)
# spellings, since a Python config mirroring a Tiptap descriptor may use either.
_KEY_ALIASES: dict[str, tuple[str, ...]] = {
    "parseHTML": ("parseHTML", "parse_html"),
    "renderHTML": ("renderHTML", "render_html"),
    "addAttributes": ("addAttributes", "add_attributes"),
    "atom": ("atom",),
    "name": ("name",),
    "markdown": ("markdown",),
    "setMeta": ("setMeta", "set_meta"),
    "docChanged": ("docChanged", "doc_changed"),
    "descendants": ("descendants",),
    "wrapIn": ("wrapIn", "wrap_in"),
    "validateFn": ("validateFn", "validate_fn"),
    "onUpload": ("onUpload", "on_upload"),
    "src": ("src",),
}

INDIVIDUAL_TABLE_PACKAGES = frozenset(
    {
        "@tiptap/extension-table-row",
        "@tiptap/extension-table-cell",
        "@tiptap/extension-table-header",
    }
)

MUTATING_METHOD_NAMES = frozenset(
    {
        "insert",
        "insertText",
        "insert_text",
        "replace",
        "replaceWith",
        "replace_with",
        "replaceRange",
        "replace_range",
        "replaceRangeWith",
        "replace_range_with",
        "delete",
        "deleteRange",
        "delete_range",
        "addMark",
        "add_mark",
        "removeMark",
        "remove_mark",
        "setNodeMarkup",
        "set_node_markup",
        "setNodeAttribute",
        "set_node_attribute",
        "setDocAttribute",
        "set_doc_attribute",
    }
)

APPEND_TRANSACTION_NAMES = frozenset({"appendTransaction", "append_transaction"})


def key_name(node: ast.AST | None) -> str | None:
    """String value of a dict key or attribute/keyword name node."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def dict_get_any(d: ast.AST | None, *names: str) -> ast.AST | None:
    """Return the value for the first matching key (any alias) on a Dict literal."""
    if not isinstance(d, ast.Dict):
        return None
    wanted: set[str] = set()
    for n in names:
        wanted.update(_KEY_ALIASES.get(n, (n,)))
    for k, v in zip(d.keys, d.values):
        if key_name(k) in wanted:
            return v
    return None


def dict_has_any(d: ast.AST | None, *names: str) -> bool:
    return dict_get_any(d, *names) is not None


def is_true_literal(node: ast.AST | None) -> bool:
    return isinstance(node, ast.Constant) and node.value is True


def literal_str(node: ast.AST | None) -> str | None:
    if node is None:
        return None
    for _, value in string_constants(node):
        return value
    return None


def is_env_access(node: ast.AST | None) -> bool:
    """True for os.environ[...], os.environ.get(...), os.getenv(...)."""
    if node is None:
        return False
    if isinstance(node, ast.Call):
        chain = attr_chain(node) or []
        if chain[-2:] == ["environ", "get"] or (chain and chain[-1] == "getenv"):
            return True
        return False
    if isinstance(node, ast.Subscript):
        val = node.value
        return isinstance(val, ast.Attribute) and val.attr == "environ"
    if isinstance(node, ast.Attribute):
        return node.attr == "environ" or (
            isinstance(node.value, ast.Attribute) and node.value.attr == "environ"
        )
    return False


def func_or_method_name(node: ast.AST) -> str | None:
    """Name of a called function/method, e.g. `wrap_in` in `commands.wrap_in(...)`."""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return None


def is_call_named(node: ast.AST | None, *names: str) -> bool:
    if not isinstance(node, ast.Call):
        return False
    wanted: set[str] = set()
    for n in names:
        wanted.update(_KEY_ALIASES.get(n, (n,)))
    return func_or_method_name(node.func) in wanted


def function_named(node: ast.AST, *names: str) -> bool:
    if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        return False
    wanted: set[str] = set()
    for n in names:
        wanted.update(_KEY_ALIASES.get(n, (n,)))
    return node.name in wanted


def iter_dicts(tree: ast.AST) -> Iterable[ast.Dict]:
    for node in ast.walk(tree):
        if isinstance(node, ast.Dict):
            yield node


def imports_matching(tree: ast.AST, needle: str) -> bool:
    """True if any import module name contains `needle` (case-insensitive)."""
    needle = needle.lower()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            if any(needle in alias.name.lower() for alias in node.names):
                return True
        elif isinstance(node, ast.ImportFrom):
            if node.module and needle in node.module.lower():
                return True
    return False


__all__ = [
    "attr_chain",
    "loc",
    "string_constants",
    "INDIVIDUAL_TABLE_PACKAGES",
    "MUTATING_METHOD_NAMES",
    "APPEND_TRANSACTION_NAMES",
    "key_name",
    "dict_get_any",
    "dict_has_any",
    "is_true_literal",
    "literal_str",
    "is_env_access",
    "func_or_method_name",
    "is_call_named",
    "function_named",
    "iter_dicts",
    "imports_matching",
]
