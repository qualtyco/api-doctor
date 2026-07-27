"""resend-no-error-code-mapping"""
from __future__ import annotations
import ast
import re

RULE_KEY = "resend-no-error-code-mapping"

def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    if "resend" not in source.lower():
        return []
    if not any(isinstance(n, ast.ExceptHandler) for n in ast.walk(tree)):
        return []
    if re.search(r"\b(400|401|403|422|429)\b", source) and ("status" in source.lower() or "http" in source.lower()):
        return []
    for node in ast.walk(tree):
        if not isinstance(node, ast.ExceptHandler):
            continue
        for child in ast.walk(node):
            if isinstance(child, ast.Constant) and child.value == 500:
                line = getattr(child, "lineno", 1) or 1
                col = (getattr(child, "col_offset", 0) or 0) + 1
                return [{"file": path, "line": line, "column": col, "ruleKey": RULE_KEY}]
    return []
