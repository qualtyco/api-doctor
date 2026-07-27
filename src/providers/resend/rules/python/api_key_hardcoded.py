"""resend-api-key-hardcoded"""
from __future__ import annotations

import ast
from ast_utils import RESEND_KEY_RE, loc, string_constants

RULE_KEY = "resend-api-key-hardcoded"


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out = []
    for node in ast.walk(tree):
        for n, value in string_constants(node):
            if RESEND_KEY_RE.search(value):
                line, col, end_line, end_col = loc(n)
                out.append(
                    {
                        "file": path,
                        "line": line,
                        "column": col,
                        "endLine": end_line,
                        "endColumn": end_col,
                        "ruleKey": RULE_KEY,
                    }
                )
                break
    return out
