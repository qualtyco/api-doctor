"""tiptap-tiptap-markdown-missing-node-spec (python analog, reliability)

The JS rule requires both a `@tiptap/core` and `tiptap-markdown` import plus a
`Node.create({...})` call with no markdown serialization spec. There is no
Python `tiptap-markdown` package, but a Python service that converts Tiptap
JSON documents to markdown (e.g. a backend export pipeline) reimplements the
same node-registry shape: a dict per node type with a `name` (and usually a
`group`) but no `markdown` spec. This flags such a dict when the file also
imports something recognizably Tiptap- and markdown-related (module names
containing "tiptap" and "markdown").

Flags (in a file importing a tiptap-ish and a markdown-ish module):
    CALLOUT_NODE = {"name": "callout", "group": "block"}  # no "markdown" key

Does NOT flag:
    CALLOUT_NODE = {"name": "callout", "group": "block", "markdown": {...}}
    WIDGET_NODE = {"name": "widget", "atom": True}  # no "group"/"content" — not a node-spec shape
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))

from utils import dict_get_any, dict_has_any, imports_matching, iter_dicts, loc  # noqa: E402

RULE_KEY = "tiptap-tiptap-markdown-missing-node-spec"

# Require a companion field beyond `name` so we only match dicts shaped like a
# node/mark registration, not any unrelated dict that happens to have a name.
_NODE_SPEC_COMPANION_KEYS = ("group", "content")


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    if not (imports_matching(tree, "tiptap") and imports_matching(tree, "markdown")):
        return []

    out: list[dict] = []
    for d in iter_dicts(tree):
        if not dict_has_any(d, "name"):
            continue
        if not any(dict_get_any(d, key) is not None for key in _NODE_SPEC_COMPANION_KEYS):
            continue
        if dict_has_any(d, "markdown"):
            continue
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
