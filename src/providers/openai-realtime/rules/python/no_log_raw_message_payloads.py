"""openai-realtime-no-log-raw-message-payloads

Parity with the JS rule: every inbound Realtime message can include
`response.audio.delta` payloads (base64-encoded live call audio) and
transcript content. Logging the raw message verbatim (via `async for
message in ws:` / `for message in ws:`) writes a durable, unredacted record
of live conversation content into whatever log sink the app ships to.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

from ast_utils import loc

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import collect_realtime_socket_var_names, is_tracked_socket_ref  # noqa: E402

RULE_KEY = "openai-realtime-no-log-raw-message-payloads"

LOG_METHOD_NAMES = frozenset({"info", "warning", "warn", "error", "debug", "log", "critical", "exception"})
# `print(...)` is a bare-call builtin — Python's idiomatic equivalent of JS's
# member-call `console.log(...)` for dumping a value verbatim.
BARE_LOG_FUNCTION_NAMES = frozenset({"print"})


def _is_log_call(node: ast.AST) -> bool:
    if not isinstance(node, ast.Call):
        return False
    if isinstance(node.func, ast.Attribute) and node.func.attr in LOG_METHOD_NAMES:
        return True
    return isinstance(node.func, ast.Name) and node.func.id in BARE_LOG_FUNCTION_NAMES


def _references_raw_param(arg: ast.AST | None, param_name: str) -> bool:
    if arg is None:
        return False
    if isinstance(arg, ast.Name) and arg.id == param_name:
        return True
    if (
        isinstance(arg, ast.Call)
        and isinstance(arg.func, ast.Attribute)
        and arg.func.attr in {"decode", "strip"}
        and isinstance(arg.func.value, ast.Name)
        and arg.func.value.id == param_name
    ):
        return True
    if isinstance(arg, ast.JoinedStr):
        for v in arg.values:
            if isinstance(v, ast.FormattedValue) and _references_raw_param(v.value, param_name):
                return True
    return False


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    socket_var_names = collect_realtime_socket_var_names(tree)
    if not socket_var_names:
        return []

    out: list[dict] = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.For, ast.AsyncFor)):
            continue
        if not is_tracked_socket_ref(node.iter, socket_var_names) or not isinstance(node.target, ast.Name):
            continue

        param_name = node.target.id
        for stmt in node.body:
            for call in ast.walk(stmt):
                if not _is_log_call(call):
                    continue
                if any(_references_raw_param(a, param_name) for a in call.args):
                    line, col, _, _ = loc(call)
                    out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
