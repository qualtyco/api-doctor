"""openai-realtime-verify-deprecated-session-fields

Parity with the JS rule: a `session.update` payload setting `temperature`
relies on a field not documented in the current GA Realtime sessions schema.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

from ast_utils import loc

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import dict_get, dict_get_pair  # noqa: E402

RULE_KEY = "openai-realtime-verify-deprecated-session-fields"


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []

    for node in ast.walk(tree):
        if not isinstance(node, ast.Dict):
            continue
        type_val = dict_get(node, "type")
        if not (isinstance(type_val, ast.Constant) and type_val.value == "session.update"):
            continue

        session_val = dict_get(node, "session")
        if not isinstance(session_val, ast.Dict):
            continue

        pair = dict_get_pair(session_val, "temperature")
        if pair is None:
            continue

        key_node, _ = pair
        line, col, _, _ = loc(key_node)
        out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
