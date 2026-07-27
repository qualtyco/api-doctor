"""resend-missing-idempotency-key"""
from __future__ import annotations
import ast
import sys
from pathlib import Path
_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import has_key_in_call, is_resend_send

RULE_KEY = "resend-missing-idempotency-key"

def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not is_resend_send(node):
            continue
        if has_key_in_call(node, "idempotency_key") or has_key_in_call(node, "idempotencyKey"):
            continue
        line = getattr(node, "lineno", 1) or 1
        col = (getattr(node, "col_offset", 0) or 0) + 1
        out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})
    return out
