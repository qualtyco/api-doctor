"""resend-api-key-hardcoded"""
from __future__ import annotations

import ast
import re
from ast_utils import loc, string_constants

RULE_KEY = "resend-api-key-hardcoded"

# Candidate extractor: `re_` + word characters. Word boundary avoids `pre_...`.
# `re_` is also a very common snake_case prefix (`re_activate_available_at`),
# so a candidate only counts when it has the shape of a real Resend secret:
# `re_` + optional short key-id segment + long random token — at least 16
# alphanumeric characters overall, containing a digit or uppercase letter
# (random base62 practically always does; snake_case words never do).
RESEND_KEY_CANDIDATE = re.compile(r"\bre_[A-Za-z0-9_]+")


def _looks_like_resend_key(token: str) -> bool:
    segments = token[len("re_"):].split("_")
    # Real keys are `re_<token>` or `re_<keyid>_<token>`; three or more
    # segments is a snake_case identifier, not a key.
    if len(segments) > 2 or any(not s for s in segments):
        return False
    chars = "".join(segments)
    if len(chars) < 16:
        return False
    return re.search(r"[0-9A-Z]", chars) is not None


def _contains_resend_key(value: str) -> bool:
    return any(_looks_like_resend_key(m) for m in RESEND_KEY_CANDIDATE.findall(value))


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out = []
    for node in ast.walk(tree):
        for n, value in string_constants(node):
            if _contains_resend_key(value):
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
