"""resend-from-address-not-friendly-format"""
from __future__ import annotations
import ast
import re
import sys
from pathlib import Path
_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from ast_utils import loc
from utils import is_resend_emails_send

RULE_KEY = "resend-from-address-not-friendly-format"
BARE_EMAIL = re.compile(r"^[^<>\s]+@[^<>\s]+$")

def _from_value(call: ast.Call):
    for kw in call.keywords:
        if kw.arg == "from" and isinstance(kw.value, ast.Constant) and isinstance(kw.value.value, str):
            return kw.value, kw.value.value
    if call.args and isinstance(call.args[0], ast.Dict):
        for k, v in zip(call.args[0].keys, call.args[0].values):
            if isinstance(k, ast.Constant) and k.value == "from" and isinstance(v, ast.Constant) and isinstance(v.value, str):
                return v, v.value
    return None

def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not is_resend_emails_send(node):
            continue
        found = _from_value(node)
        if not found:
            continue
        n, value = found
        if BARE_EMAIL.match(value.strip()):
            line, col, end_line, end_col = loc(n)
            out.append({"file": path, "line": line, "column": col, "endLine": end_line, "endColumn": end_col, "ruleKey": RULE_KEY})
    return out
