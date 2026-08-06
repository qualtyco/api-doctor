"""resend-missing-idempotency-key

Suppressed inside a *generic transport wrapper*: a function that forwards a
caller-supplied subject and body straight to Resend. Such a function does not
know which logical operation it is performing, so it has no name to seed a key
with — the key has to be chosen where the intent is known. Mirrors the gate in
rules/js/missing-idempotency-key.ts; keep the two in step.
"""
from __future__ import annotations
import ast
import sys
from pathlib import Path
_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import dict_get, get_send_option_dicts, has_key_in_call, is_resend_send

RULE_KEY = "resend-missing-idempotency-key"

_FUNCTION_NODES = (ast.FunctionDef, ast.AsyncFunctionDef)
_SUBJECT_KEYS = ("subject",)
_BODY_KEYS = ("html", "text", "react")


def _parameter_names(fn: ast.AST) -> set[str]:
    """Every simple binding name introduced by a function's parameter list."""
    args = getattr(fn, "args", None)
    if args is None:
        return set()
    names = set()
    for group in (
        getattr(args, "posonlyargs", []),
        args.args,
        args.kwonlyargs,
    ):
        for arg in group:
            names.add(arg.arg)
    for extra in (args.vararg, args.kwarg):
        if extra is not None:
            names.add(extra.arg)
    return names


def _comes_from_params(value: ast.AST | None, params: set[str]) -> bool:
    """True when `value` is built from a parameter rather than fixed in source."""
    if value is None:
        return False
    for node in ast.walk(value):
        if isinstance(node, ast.Name) and node.id in params:
            return True
    return False


def _is_generic_transport_wrapper(call: ast.Call, fn: ast.AST) -> bool:
    """
    True when every payload takes both its subject and its body from the
    enclosing function's parameters.

    A payload that is not a dict literal cannot be judged, so it does not
    qualify: the rule keeps firing rather than going quiet on what it cannot see.
    """
    params = _parameter_names(fn)
    if not params:
        return False

    payloads = get_send_option_dicts(call)
    if not payloads:
        return False

    for payload in payloads:
        subject = next((dict_get(payload, k) for k in _SUBJECT_KEYS if dict_get(payload, k)), None)
        body = next((dict_get(payload, k) for k in _BODY_KEYS if dict_get(payload, k)), None)
        if subject is None or body is None:
            return False
        if not _comes_from_params(subject, params) or not _comes_from_params(body, params):
            return False
    return True


def _enclosing_functions(tree: ast.AST) -> dict[ast.AST, ast.AST]:
    """Map each call node to its innermost enclosing function definition."""
    owner: dict[ast.AST, ast.AST] = {}
    for node in ast.walk(tree):
        if not isinstance(node, _FUNCTION_NODES):
            continue
        for child in ast.walk(node):
            # Later (deeper) writes win, leaving the innermost function.
            if isinstance(child, ast.Call):
                owner[child] = node
    return owner


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out = []
    owner = _enclosing_functions(tree)
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not is_resend_send(node):
            continue
        if has_key_in_call(node, "idempotency_key") or has_key_in_call(node, "idempotencyKey"):
            continue
        fn = owner.get(node)
        if fn is not None and _is_generic_transport_wrapper(node, fn):
            continue
        line = getattr(node, "lineno", 1) or 1
        col = (getattr(node, "col_offset", 0) or 0) + 1
        out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})
    return out
