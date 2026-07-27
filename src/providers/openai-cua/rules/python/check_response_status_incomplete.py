"""openai-cua-check-response-status-incomplete

Parity with the JS rule: a function that calls responses.create() and treats
the absence of tool calls as a successful completion, without ever checking
response.status == "incomplete" anywhere in that function.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

from ast_utils import enclosing_scope_map, loc

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import is_responses_create_call  # noqa: E402

RULE_KEY = "openai-cua-check-response-status-incomplete"

SUCCESS_KEYS = frozenset({"success", "completed"})


def _is_success_dict(node: ast.AST) -> bool:
    if not isinstance(node, ast.Dict):
        return False
    for k, v in zip(node.keys, node.values):
        if (
            isinstance(k, ast.Constant)
            and k.value in SUCCESS_KEYS
            and isinstance(v, ast.Constant)
            and v.value is True
        ):
            return True
    return False


def _is_status_incomplete_check(node: ast.AST) -> bool:
    if not isinstance(node, ast.Compare) or len(node.ops) != 1 or not isinstance(node.ops[0], ast.Eq):
        return False
    left, right = node.left, node.comparators[0]

    def is_status_attr(n: ast.AST) -> bool:
        return isinstance(n, ast.Attribute) and n.attr == "status"

    def is_incomplete_literal(n: ast.AST) -> bool:
        return isinstance(n, ast.Constant) and n.value == "incomplete"

    return (is_status_attr(left) and is_incomplete_literal(right)) or (
        is_status_attr(right) and is_incomplete_literal(left)
    )


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    scope_of = enclosing_scope_map(tree)
    saw_create_call: set[int] = set()
    success_node_by_scope: dict[int, ast.AST] = {}
    saw_status_check: set[int] = set()

    for node in ast.walk(tree):
        scope = scope_of.get(id(node), tree)
        scope_id = id(scope)

        if isinstance(node, ast.Call) and is_responses_create_call(node):
            saw_create_call.add(scope_id)
        if _is_success_dict(node):
            success_node_by_scope.setdefault(scope_id, node)
        if _is_status_incomplete_check(node):
            saw_status_check.add(scope_id)

    out: list[dict] = []
    for scope_id, node in success_node_by_scope.items():
        if scope_id in saw_create_call and scope_id not in saw_status_check:
            line, col, _, _ = loc(node)
            out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})
    return out
