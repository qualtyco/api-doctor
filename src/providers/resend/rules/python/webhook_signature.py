"""resend-webhook-signature

Parity with the JS rule: only flag HTTP POST handlers that consume a request
body without verifying the webhook signature (or that parse JSON before verify).
Whole-file text heuristics and stringified examples are ignored.
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

RULE_KEY = "resend-webhook-signature"

WEBHOOK_LITERAL_RE = re.compile(
    r"^(svix-(id|timestamp|signature)|email\.(sent|delivered|delivery_delayed|complained|"
    r"bounced|opened|clicked|failed|received|scheduled|suppressed)|"
    r"contact\.(created|updated|deleted)|domain\.(created|updated|deleted))$",
    re.I,
)
REQUEST_NAMES = frozenset({"request", "req"})


def _call_from_decorator(dec: ast.expr) -> ast.Call | None:
    if isinstance(dec, ast.Call):
        return dec
    return None


def _decorator_is_post(dec: ast.expr) -> bool:
    """True when a decorator clearly marks an HTTP POST handler."""
    # @require_POST / @django.views.decorators.http.require_POST
    if isinstance(dec, ast.Name) and dec.id == "require_POST":
        return True
    if isinstance(dec, ast.Attribute) and dec.attr == "require_POST":
        return True

    call = _call_from_decorator(dec)
    if call is None:
        return False

    chain = attr_chain(call) or []
    # @app.post(...) / @router.post(...)
    if chain and chain[-1] == "post":
        return True

    # @app.route(..., methods=["POST"]) / methods=["GET", "POST"]
    if chain and chain[-1] == "route":
        for kw in call.keywords:
            if kw.arg != "methods":
                continue
            for _, value in string_constants(kw.value):
                if value.upper() == "POST":
                    return True
            if isinstance(kw.value, ast.List):
                for el in kw.value.elts:
                    s = None
                    if isinstance(el, ast.Constant) and isinstance(el.value, str):
                        s = el.value
                    if s and s.upper() == "POST":
                        return True
    return False


def _decorator_route_hint(dec: ast.expr) -> str:
    """Best-effort path string from @route/@post first positional arg."""
    call = _call_from_decorator(dec)
    if call is None or not call.args:
        return ""
    s = None
    arg0 = call.args[0]
    if isinstance(arg0, ast.Constant) and isinstance(arg0.value, str):
        s = arg0.value
    return s or ""


def _is_post_handler(fn: ast.AST) -> bool:
    if not isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
        return False
    return any(_decorator_is_post(d) for d in fn.decorator_list)


def _handler_webhook_evidence(fn: ast.AST, path: str) -> bool:
    if isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
        if re.search(r"webhook", fn.name, re.I):
            return True
        for dec in fn.decorator_list:
            if re.search(r"webhook", _decorator_route_hint(dec), re.I):
                return True
        for node in ast.walk(fn):
            for _, value in string_constants(node):
                if WEBHOOK_LITERAL_RE.match(value):
                    return True
                if value.lower() in {"svix-id", "svix-timestamp", "svix-signature"}:
                    return True
    return False


def _lineno(node: ast.AST) -> int:
    return getattr(node, "lineno", 1) or 1


def _is_verify_call(call: ast.Call) -> bool:
    if call_ends_with(call, "verify"):
        return True
    chain = attr_chain(call) or []
    if chain and chain[-1] == "verify":
        return True
    if isinstance(call.func, ast.Name) and "verify" in call.func.id.lower():
        return True
    # hmac.new(...) — manual signature verification
    if call_ends_with(call, "new") and chain and chain[0] == "hmac":
        return True
    return False


def _body_kind(node: ast.AST) -> str | None:
    """
    Return 'raw' for raw-body reads (ok before verify), 'json' for parsed-body
    reads (must not precede verify), or None.
    """
    if isinstance(node, ast.Attribute):
        if node.attr in {"body", "data"} and isinstance(node.value, ast.Name) and node.value.id in REQUEST_NAMES:
            return "raw"
        if node.attr == "json" and isinstance(node.value, ast.Name) and node.value.id in REQUEST_NAMES:
            return "json"
        return None

    if not isinstance(node, ast.Call):
        return None

    chain = attr_chain(node) or []
    if len(chain) >= 2 and chain[0] in REQUEST_NAMES:
        if chain[-1] in {"get_data", "get_data_as_text"}:
            return "raw"
        if chain[-1] in {"get_json", "json"}:
            return "json"

    # json.loads(...)
    if call_ends_with(node, "loads") or (
        isinstance(node.func, ast.Name) and node.func.id == "loads"
    ):
        return "json"

    return None


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    if not imports_module(tree, "resend"):
        return []

    out: list[dict] = []

    for fn in ast.walk(tree):
        if not _is_post_handler(fn):
            continue
        assert isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef))

        if not _handler_webhook_evidence(fn, path):
            continue

        first_json: int | None = None
        first_raw: int | None = None
        first_verify: int | None = None

        for node in ast.walk(fn):
            if isinstance(node, ast.Call) and _is_verify_call(node):
                line = _lineno(node)
                first_verify = line if first_verify is None else min(first_verify, line)
                continue

            kind = _body_kind(node)
            if kind == "raw":
                line = _lineno(node)
                first_raw = line if first_raw is None else min(first_raw, line)
            elif kind == "json":
                line = _lineno(node)
                first_json = line if first_json is None else min(first_json, line)

        consumes = first_json is not None or first_raw is not None
        if not consumes:
            continue

        line, col, _, _ = loc(fn)
        if first_verify is None:
            out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})
            continue

        # Parsed JSON before verify is unsafe (same as JS).
        if first_json is not None and first_verify > first_json:
            out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
