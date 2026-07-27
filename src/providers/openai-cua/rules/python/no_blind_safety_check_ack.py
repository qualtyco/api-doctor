"""openai-cua-no-blind-safety-check-ack

Parity with the JS rule: flags a comprehension/filter over a safety-checks
collection whose predicate never inspects `.code`/`.message` (or the dict-key
equivalents) — i.e. it acknowledges every check present instead of evaluating
each one against a policy.
"""
from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

from ast_utils import loc

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))

RULE_KEY = "openai-cua-no-blind-safety-check-ack"

SAFETY_CHECK_NAME_RE = re.compile(r"safety[_-]?check", re.I)
CODE_OR_MESSAGE_KEYS = frozenset({"code", "message"})


def _looks_like_safety_checks(node: ast.AST | None) -> bool:
    if node is None:
        return False
    if isinstance(node, ast.Name):
        return bool(SAFETY_CHECK_NAME_RE.search(node.id))
    if isinstance(node, ast.Attribute):
        return bool(SAFETY_CHECK_NAME_RE.search(node.attr)) or _looks_like_safety_checks(node.value)
    if isinstance(node, ast.BoolOp):
        return any(_looks_like_safety_checks(v) for v in node.values)
    return False


def _references_code_or_message(node: ast.AST) -> bool:
    for n in ast.walk(node):
        if isinstance(n, ast.Attribute) and n.attr in CODE_OR_MESSAGE_KEYS:
            return True
        if isinstance(n, ast.Subscript):
            sl = n.slice
            if isinstance(sl, ast.Constant) and sl.value in CODE_OR_MESSAGE_KEYS:
                return True
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == "get":
            if n.args and isinstance(n.args[0], ast.Constant) and n.args[0].value in CODE_OR_MESSAGE_KEYS:
                return True
    return False


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.ListComp) and len(node.generators) == 1:
            gen = node.generators[0]
            if not gen.ifs or not _looks_like_safety_checks(gen.iter):
                continue
            if any(_references_code_or_message(cond) for cond in gen.ifs):
                continue
            line, col, _, _ = loc(node)
            out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "filter":
            if len(node.args) != 2:
                continue
            fn_arg, iterable = node.args
            if not isinstance(fn_arg, ast.Lambda):
                continue
            if not _looks_like_safety_checks(iterable):
                continue
            if _references_code_or_message(fn_arg.body):
                continue
            line, col, _, _ = loc(node)
            out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
