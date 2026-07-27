"""openai-realtime-migrate-beta-to-ga

Parity with the JS rule: a Realtime connection that sends the deprecated
`OpenAI-Beta: realtime=v1` header must migrate the session/event shapes to
the GA interface instead.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

from ast_utils import loc

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import (  # noqa: E402
    collect_dict_var_values,
    collect_realtime_url_var_names,
    find_header_value,
    get_headers_arg,
    is_realtime_connect_call,
    literal_string,
    resolve_headers_node,
)

RULE_KEY = "openai-realtime-migrate-beta-to-ga"


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    url_var_names = collect_realtime_url_var_names(tree)
    dict_var_values = collect_dict_var_values(tree)
    out: list[dict] = []

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not is_realtime_connect_call(node, url_var_names):
            continue
        headers = resolve_headers_node(get_headers_arg(node), dict_var_values)
        pair = find_header_value(headers, "OpenAI-Beta")
        if pair is None:
            continue
        key_node, value_node = pair
        value = literal_string(value_node)
        if value and "realtime=v1" in value:
            line, col, _, _ = loc(key_node)
            out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
