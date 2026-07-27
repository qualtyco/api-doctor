"""resend-request-id-not-logged"""
from __future__ import annotations
import ast
import re

RULE_KEY = "resend-request-id-not-logged"
REQ_ID = re.compile(r"x-request-id|x-resend-request-id|request_id|requestId", re.I)

def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    if "resend" not in source.lower():
        return []
    if not any(isinstance(n, ast.ExceptHandler) for n in ast.walk(tree)):
        return []
    if REQ_ID.search(source):
        return []
    for node in ast.walk(tree):
        if isinstance(node, ast.ExceptHandler):
            line = getattr(node, "lineno", 1) or 1
            col = (getattr(node, "col_offset", 0) or 0) + 1
            return [{"file": path, "line": line, "column": col, "ruleKey": RULE_KEY}]
    return []
