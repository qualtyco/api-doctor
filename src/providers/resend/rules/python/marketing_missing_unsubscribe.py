"""resend-marketing-missing-unsubscribe

Parity with the JS rule: only flag a send whose tags mark it as marketing
and that same send lacks an unsubscribe header/placeholder.
"""
from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import dict_get, get_send_option_dicts, is_resend_send, literal_string

RULE_KEY = "resend-marketing-missing-unsubscribe"
MARKETING_TAG = re.compile(r"marketing|campaign|newsletter|promotion", re.I)
UNSUBSCRIBE_PLACEHOLDER = "{{{RESEND_UNSUBSCRIBE_URL}}}"


def _has_marketing_tag(opts: ast.Dict) -> bool:
    tags = dict_get(opts, "tags")
    if not isinstance(tags, ast.List):
        return False
    for el in tags.elts:
        if not isinstance(el, ast.Dict):
            continue
        value = literal_string(dict_get(el, "value"))
        if value is not None and MARKETING_TAG.search(value):
            return True
    return False


def _has_list_unsubscribe_header(opts: ast.Dict) -> bool:
    headers = dict_get(opts, "headers")
    if not isinstance(headers, ast.Dict):
        return False
    for k in headers.keys:
        key = literal_string(k)
        if key is not None and key.lower() == "list-unsubscribe":
            return True
    return False


def _html_has_unsubscribe_placeholder(opts: ast.Dict) -> bool:
    html = literal_string(dict_get(opts, "html"))
    return html is not None and UNSUBSCRIBE_PLACEHOLDER in html


def _has_unsubscribe_mechanism(opts: ast.Dict) -> bool:
    return _has_list_unsubscribe_header(opts) or _html_has_unsubscribe_placeholder(opts)


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not is_resend_send(node):
            continue
        for opts in get_send_option_dicts(node):
            if _has_marketing_tag(opts) and not _has_unsubscribe_mechanism(opts):
                line = getattr(node, "lineno", 1) or 1
                col = (getattr(node, "col_offset", 0) or 0) + 1
                out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})
                break
    return out
