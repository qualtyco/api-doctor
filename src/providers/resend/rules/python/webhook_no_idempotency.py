"""resend-webhook-no-idempotency

Parity with the JS rule's intent (svix + POST + no dedup), adapted for Python
where many POST views often share a file with a single svix import. Only
handlers that look like webhook consumers are considered.
"""
from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

from ast_utils import attr_chain, call_ends_with, imports_module, loc, string_constants

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))

RULE_KEY = "resend-webhook-no-idempotency"

DEDUP_OBJECTS = frozenset({"redis", "kv", "db", "prisma", "supabase", "cache", "store"})
DEDUP_METHODS = frozenset(
    {"has", "add", "sadd", "sismember", "exists", "findUnique", "findFirst", "upsert", "find_one", "find"}
)
EVENT_ID_KEYS = frozenset({"email_id", "eventId", "event_id"})


def _decorator_is_post(dec: ast.expr) -> bool:
    if isinstance(dec, ast.Name) and dec.id == "require_POST":
        return True
    if isinstance(dec, ast.Attribute) and dec.attr == "require_POST":
        return True
    if not isinstance(dec, ast.Call):
        return False
    chain = attr_chain(dec) or []
    if chain and chain[-1] == "post":
        return True
    if chain and chain[-1] == "route":
        for kw in dec.keywords:
            if kw.arg != "methods":
                continue
            if isinstance(kw.value, ast.List):
                for el in kw.value.elts:
                    if isinstance(el, ast.Constant) and isinstance(el.value, str) and el.value.upper() == "POST":
                        return True
            for _, value in string_constants(kw.value):
                if value.upper() == "POST":
                    return True
    return False


def _decorator_route_hint(dec: ast.expr) -> str:
    if not isinstance(dec, ast.Call) or not dec.args:
        return ""
    arg0 = dec.args[0]
    if isinstance(arg0, ast.Constant) and isinstance(arg0.value, str):
        return arg0.value
    return ""


def _is_post_handler(fn: ast.AST) -> bool:
    return isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)) and any(
        _decorator_is_post(d) for d in fn.decorator_list
    )


def _is_webhook_handler(fn: ast.FunctionDef | ast.AsyncFunctionDef) -> bool:
    if re.search(r"webhook", fn.name, re.I):
        return True
    for dec in fn.decorator_list:
        if re.search(r"webhook", _decorator_route_hint(dec), re.I):
            return True
    for node in ast.walk(fn):
        if isinstance(node, ast.Call) and (
            call_ends_with(node, "verify")
            or ((attr_chain(node) or [""])[-1] == "verify")
        ):
            return True
        for _, value in string_constants(node):
            if value.lower() in {"svix-id", "svix-timestamp", "svix-signature"}:
                return True
    return False


def _has_dedup_signal(fn: ast.AST) -> bool:
    for node in ast.walk(fn):
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in {"set", "Set", "dict"}:
                return True
            # obj.method(...) store-style dedup
            if isinstance(node.func, ast.Attribute):
                method = node.func.attr
                if method in DEDUP_METHODS:
                    return True
                if isinstance(node.func.value, ast.Name) and node.func.value.id in DEDUP_OBJECTS:
                    return True
                # chained .get("email_id") — attr_chain breaks on Call receivers
                if method == "get" and node.args:
                    key = node.args[0]
                    if (
                        isinstance(key, ast.Constant)
                        and isinstance(key.value, str)
                        and key.value in EVENT_ID_KEYS
                    ):
                        return True

            chain = attr_chain(node) or []
            if chain:
                obj = chain[0]
                method = chain[-1]
                if obj in DEDUP_OBJECTS or method in DEDUP_METHODS:
                    return True

        if isinstance(node, ast.Attribute) and node.attr in EVENT_ID_KEYS:
            return True

        if isinstance(node, ast.Subscript):
            sl = node.slice
            if isinstance(sl, ast.Constant) and isinstance(sl.value, str) and sl.value in EVENT_ID_KEYS:
                return True

        if isinstance(node, ast.Name) and re.search(
            r"processed|seen_events|idempoten|already_processed|dedup", node.id, re.I
        ):
            return True

    return False


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    if not imports_module(tree, "svix"):
        return []

    out: list[dict] = []
    for fn in ast.walk(tree):
        if not _is_post_handler(fn):
            continue
        assert isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef))
        if not _is_webhook_handler(fn):
            continue
        if _has_dedup_signal(fn):
            continue
        line, col, _, _ = loc(fn)
        out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})
    return out
