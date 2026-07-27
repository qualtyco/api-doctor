"""tiptap-addAttributes-missing-renderHTML (python analog, correctness)

Tiptap's `addAttributes()` descriptors are plain JS objects, so a Python
backend that mirrors the same extension schema as data (e.g. a config file
validated/generated server-side, or a schema shared between a Python CMS and
the Tiptap frontend) uses the identical `parseHTML`/`renderHTML` vocabulary in
a dict literal. This flags any dict literal that defines `parseHTML` (or
`parse_html`) but not `renderHTML` (or `render_html`) — the same asymmetry
that silently drops the attribute on the JS side.

Flags:
    {"parseHTML": "el => el.getAttribute('data-label')"}

Does NOT flag:
    {"parseHTML": "...", "renderHTML": "..."}
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))

from utils import dict_has_any, iter_dicts, loc  # noqa: E402

RULE_KEY = "tiptap-addAttributes-missing-renderHTML"


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []

    for d in iter_dicts(tree):
        if dict_has_any(d, "parseHTML") and not dict_has_any(d, "renderHTML"):
            line, col, end_line, end_col = loc(d)
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

    return out
