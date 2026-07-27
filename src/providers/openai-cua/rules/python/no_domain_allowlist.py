"""openai-cua-no-domain-allowlist

Parity with the JS rule: a function that executes computer-use page actions
(click/type/goto/fill/...) with no origin/domain allowlist check anywhere in
that same function is flagged once per function.
"""
from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

from ast_utils import attr_chain, enclosing_scope_map, loc

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))

RULE_KEY = "openai-cua-no-domain-allowlist"

ACTION_METHOD_NAMES = frozenset(
    {"click", "type", "press", "move", "goto", "fill", "dblclick", "drag_and_drop", "hover"}
)
ORIGIN_CHECK_NAME_RE = re.compile(r"allow.?list|allowed.?domain", re.I)
ORIGIN_ATTR_NAMES = frozenset({"hostname", "netloc", "origin"})


def _is_page_action_call(call: ast.Call) -> bool:
    if not isinstance(call.func, ast.Attribute) or call.func.attr not in ACTION_METHOD_NAMES:
        return False
    chain = attr_chain(call) or []
    return any(re.search(r"page$", n, re.I) for n in chain)


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    scope_of = enclosing_scope_map(tree)
    action_by_scope: dict[int, ast.Call] = {}
    origin_seen_scopes: set[int] = set()

    for node in ast.walk(tree):
        scope = scope_of.get(id(node), tree)

        if isinstance(node, ast.Call):
            if _is_page_action_call(node) and id(scope) not in action_by_scope:
                action_by_scope[id(scope)] = node
            chain = attr_chain(node) or []
            if chain and chain[-1] == "urlparse":
                origin_seen_scopes.add(id(scope))
        elif isinstance(node, ast.Attribute):
            if node.attr in ORIGIN_ATTR_NAMES or ORIGIN_CHECK_NAME_RE.search(node.attr):
                origin_seen_scopes.add(id(scope))
        elif isinstance(node, ast.Name):
            if ORIGIN_CHECK_NAME_RE.search(node.id):
                origin_seen_scopes.add(id(scope))

    out: list[dict] = []
    for scope_id, node in action_by_scope.items():
        if scope_id in origin_seen_scopes:
            continue
        line, col, _, _ = loc(node)
        out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})
    return out
