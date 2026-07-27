"""openai-cua-structured-step-metadata-not-text-json

Parity with the JS rule: flags a function that both (a) searches free text for
a brace via str.find/rfind/index/rindex, and (b) calls json.loads on a slice
of that text — manual brace-hunting JSON extraction instead of a function
tool / structured output.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

from ast_utils import enclosing_scope_map, loc

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))

RULE_KEY = "openai-cua-structured-step-metadata-not-text-json"

BRACE_SEARCH_METHODS = frozenset({"find", "rfind", "index", "rindex"})


def _is_brace_search_call(node: ast.AST) -> bool:
    if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
        return False
    if node.func.attr not in BRACE_SEARCH_METHODS:
        return False
    if not node.args:
        return False
    arg = node.args[0]
    return isinstance(arg, ast.Constant) and isinstance(arg.value, str) and "{" in arg.value


def _is_json_loads_on_slice(node: ast.AST) -> bool:
    if not isinstance(node, ast.Call):
        return False
    func = node.func
    is_loads = (isinstance(func, ast.Attribute) and func.attr == "loads") or (
        isinstance(func, ast.Name) and func.id == "loads"
    )
    if not is_loads or not node.args:
        return False
    arg = node.args[0]
    return isinstance(arg, ast.Subscript) and isinstance(arg.slice, ast.Slice)


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    scope_of = enclosing_scope_map(tree)
    brace_search_scopes: set[int] = set()
    json_slice_scopes: set[int] = set()
    report_node_by_scope: dict[int, ast.AST] = {}

    for node in ast.walk(tree):
        scope = scope_of.get(id(node), tree)
        scope_id = id(scope)

        if _is_brace_search_call(node):
            brace_search_scopes.add(scope_id)
            report_node_by_scope.setdefault(scope_id, node)
        if _is_json_loads_on_slice(node):
            json_slice_scopes.add(scope_id)
            report_node_by_scope.setdefault(scope_id, node)

    out: list[dict] = []
    for scope_id in brace_search_scopes & json_slice_scopes:
        node = report_node_by_scope[scope_id]
        line, col, _, _ = loc(node)
        out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})
    return out
