"""supabase-no-user-metadata-authz

Parity with the JS rule: `user_metadata` is client-writable, so reading an
authz key from it (`user.user_metadata["role"]` / `.get("role")`) or writing
one via `sign_up`/`update_user` (`{"data": {"role": ...}}`, optionally
nested under `"options"`) lets any signed-in user self-promote.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import call_report_loc, is_auth_user_metadata_write, is_user_metadata_authz_read

RULE_KEY = "supabase-no-user-metadata-authz"


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []
    for node in ast.walk(tree):
        flagged = False
        if isinstance(node, (ast.Subscript, ast.Call)) and is_user_metadata_authz_read(node):
            flagged = True
        elif isinstance(node, ast.Call) and is_auth_user_metadata_write(node):
            flagged = True
        if not flagged:
            continue
        if isinstance(node, ast.Call):
            line, col = call_report_loc(node)
        else:
            line = getattr(node, "lineno", 1) or 1
            col = (getattr(node, "col_offset", 0) or 0) + 1
        out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})
    return out
