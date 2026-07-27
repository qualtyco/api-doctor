"""supabase-idempotent-mutations

Parity with the JS rule: `.insert(payload)` with no idempotency/dedupe key
field is not safely retryable. `.upsert(..., on_conflict=...)` is the
documented fix and is exempt — only plain `.insert()` calls are checked.
"""
from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import call_report_loc, chain_object_call, is_supabase_table_call, member_prop_name

RULE_KEY = "supabase-idempotent-mutations"

_KEY_RE = re.compile(r"idempot|dedupe", re.I)
_ID_RE = re.compile(r"^(id|uuid)$", re.I)
_SUFFIX_RE = re.compile(r"_(key|uuid)$", re.I)


def _looks_like_idempotency_key(name: str) -> bool:
    return bool(_KEY_RE.search(name) or _ID_RE.match(name) or _SUFFIX_RE.search(name))


def _dict_has_idempotency_key(d: ast.AST | None) -> bool:
    if not isinstance(d, ast.Dict):
        return False
    for k in d.keys:
        if isinstance(k, ast.Constant) and isinstance(k.value, str) and _looks_like_idempotency_key(k.value):
            return True
    return False


def _payload_has_idempotency_key(arg: ast.AST | None) -> bool:
    if isinstance(arg, ast.Dict):
        return _dict_has_idempotency_key(arg)
    if isinstance(arg, ast.List):
        return any(_dict_has_idempotency_key(el) for el in arg.elts)
    return False


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or member_prop_name(node) != "insert":
            continue

        obj_call = chain_object_call(node)
        if not obj_call or not is_supabase_table_call(obj_call):
            continue

        if not node.args:
            continue
        arg = node.args[0]
        if _payload_has_idempotency_key(arg):
            continue

        line, col = call_report_loc(node)
        out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
