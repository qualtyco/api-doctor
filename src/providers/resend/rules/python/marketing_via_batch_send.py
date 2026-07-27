"""resend-marketing-via-batch-send"""
from __future__ import annotations
import ast
import re
import sys
from pathlib import Path
_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import is_resend_batch_send

RULE_KEY = "resend-marketing-via-batch-send"
MARKETING = re.compile(r"\b(newsletter|marketing|campaign|broadcast|promo)\b", re.I)

def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    if not MARKETING.search(source):
        return []
    out = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not is_resend_batch_send(node):
            continue
        line = getattr(node, "lineno", 1) or 1
        col = (getattr(node, "col_offset", 0) or 0) + 1
        out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})
    return out
