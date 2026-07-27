"""resend-missing-tags

Parity with JS: only inspect statically-visible send option dicts. Dynamic
argument shapes (variable payloads) are skipped to avoid false positives.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import dict_get, get_send_option_dicts, is_resend_send

RULE_KEY = "resend-missing-tags"


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not is_resend_send(node):
            continue
        option_dicts = get_send_option_dicts(node)
        if not option_dicts:
            continue  # dynamic shape: cannot tell
        if any(dict_get(opts, "tags") is None for opts in option_dicts):
            line = getattr(node, "lineno", 1) or 1
            col = (getattr(node, "col_offset", 0) or 0) + 1
            out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})
    return out
