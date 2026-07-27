"""resend-test-domain-in-production-path"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

from ast_utils import loc, string_constants

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import is_inside_test_file

RULE_KEY = "resend-test-domain-in-production-path"
TEST_FROM = "onboarding@resend.dev"


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    if is_inside_test_file(path):
        return []
    out = []
    for node in ast.walk(tree):
        for n, value in string_constants(node):
            if TEST_FROM in value:
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
