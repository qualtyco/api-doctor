"""Shared helpers for Resend Python rules."""

from __future__ import annotations

import ast
import re

from ast_utils import (  # noqa: F401 — re-exported for rule modules
    call_ends_with,
    has_key_in_call,
    imports_module,
    string_constants,
)

_TEST_PATH_RE = re.compile(
    # Python analogue of JS isInsideTestFile (used by test-domain, not api-key).
    # Avoid bare `/tests/` — fixture trees often live under `tests/fixtures/`.
    r"(^|[/\\])__tests__[/\\]"
    r"|(^|[/\\])test_[^/\\]+\.py$"
    r"|_test\.py$"
    r"|\.(test|spec)\.[cm]?[jt]sx?$",
    re.I,
)


def is_inside_test_file(path: str) -> bool:
    """True when the path looks like a test file (mirrors JS isInsideTestFile)."""
    return bool(_TEST_PATH_RE.search(path.replace("\\", "/")))



def is_resend_emails_send(call: ast.Call) -> bool:
    return call_ends_with(call, "Emails", "send") or call_ends_with(call, "emails", "send")


def is_resend_batch_send(call: ast.Call) -> bool:
    return call_ends_with(call, "Batch", "send") or call_ends_with(call, "batch", "send")


def is_resend_send(call: ast.Call) -> bool:
    return is_resend_emails_send(call) or is_resend_batch_send(call)


def file_uses_resend(tree: ast.AST) -> bool:
    return imports_module(tree, "resend")


def dict_get(d: ast.Dict, key: str) -> ast.AST | None:
    """Return the value node for a string key in a dict literal, else None."""
    for k, v in zip(d.keys, d.values):
        if isinstance(k, ast.Constant) and k.value == key:
            return v
    return None


def literal_string(node: ast.AST | None) -> str | None:
    """Best-effort string from a Constant or f-string with only static parts."""
    if node is None:
        return None
    for _, value in string_constants(node):
        return value
    return None


def get_send_option_dicts(call: ast.Call) -> list[ast.Dict]:
    """
    Per-email option dicts for a send call (mirrors JS getSendOptionObjects):
      - Emails.send({...})           -> [{...}]
      - Batch.send([{...}, {...}])   -> [{...}, {...}]  (literal list only)
    """
    if is_resend_emails_send(call):
        if call.args and isinstance(call.args[0], ast.Dict):
            return [call.args[0]]
        return []
    if is_resend_batch_send(call):
        if not call.args or not isinstance(call.args[0], ast.List):
            return []
        return [el for el in call.args[0].elts if isinstance(el, ast.Dict)]
    return []
