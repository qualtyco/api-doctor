"""openai-cua-set-safety-identifier

Parity with the JS rule: `responses.create()` with no `safety_identifier` (or
the older `user`) keyword argument attributes policy violations to the whole
shared API key rather than a single end user.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

from ast_utils import loc

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import is_responses_create_call, kwarg_names  # noqa: E402

RULE_KEY = "openai-cua-set-safety-identifier"


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not is_responses_create_call(node):
            continue
        names = kwarg_names(node)
        if "safety_identifier" in names or "user" in names:
            continue
        # `**kwargs` unpacking — can't verify either way, don't flag.
        if any(k.arg is None for k in node.keywords):
            continue
        line, col, _, _ = loc(node)
        out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})
    return out
