"""openai-realtime-avoid-dated-preview-snapshots

Parity with the JS rule: a Realtime connection pinned to a dated preview
model snapshot (rather than the floating GA alias) maximizes exposure to an
eventual retirement with no code path to detect it.
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
from utils import (  # noqa: E402
    collect_realtime_url_var_names,
    collect_string_var_values,
    is_realtime_connect_call,
    resolve_string_value,
)

RULE_KEY = "openai-realtime-avoid-dated-preview-snapshots"

DATED_PREVIEW_MODEL_RE = re.compile(r"model=[^&'\"`]*-preview-\d{4}-\d{2}-\d{2}")


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    string_vars = collect_string_var_values(tree)
    url_var_names = collect_realtime_url_var_names(tree)
    out: list[dict] = []

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not is_realtime_connect_call(node, url_var_names):
            continue
        url_arg = node.args[0]
        url_string = resolve_string_value(url_arg, string_vars)
        if not url_string:
            continue
        if DATED_PREVIEW_MODEL_RE.search(url_string):
            line, col, _, _ = loc(url_arg)
            out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
