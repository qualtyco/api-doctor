"""tiptap-dynamic-script-no-sri (python analog, security)

The JS rule flags a `document.createElement('script')` appended without an
`integrity` (SRI) attribute. Python has no DOM, but Python code that
server-renders HTML embedding a third-party CDN script (e.g. the Tiptap
node-view widget embed) builds the same `<script src="https://...">` markup
as a plain/f-string. This flags a literal string containing a
`<script ...src="https://...">` tag with no `integrity=` attribute.

Two narrowing rules keep this aligned with the JS rule's actual intent
(a compromised *third-party* CDN serving unverified code), validated against
false positives found scanning real Python codebases:

- The `src=` value's scheme must be a literal `http(s)://` in the source —
  same-origin/relative script tags built entirely from a variable (e.g. a
  local Vite/webpack dev-server client script) are not the supply-chain risk
  this rule targets, and SRI cannot even be computed for content that isn't
  fixed at build time.
- Docstrings are skipped — a `<script src="https://...">` tag appearing only
  as *documentation* (e.g. a template-tag usage example) is not code that
  ever renders that tag.

Flags:
    html = f'<script src="https://cdn.tiptap.dev/embed.js?apiKey={key}"></script>'

Does NOT flag:
    html = (
        '<script src="https://cdn.tiptap.dev/embed.js" '
        'integrity="sha384-..." crossorigin="anonymous"></script>'
    )
    client = f'<script type="module" src="{vite_dev_server_url}/@vite/client"></script>'
"""
from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))

from utils import loc  # noqa: E402

RULE_KEY = "tiptap-dynamic-script-no-sri"

# Requires a literal absolute http(s) URL right after src= — a same-origin or
# fully-dynamic src (e.g. `src="{base_url}/client.js"`) isn't the third-party
# CDN scenario SRI protects against, and can't be hashed at scan time anyway.
_SCRIPT_SRC_RE = re.compile(r"<script\b[^>]*\bsrc\s*=\s*[\"']https?://", re.I)
_INTEGRITY_RE = re.compile(r"\bintegrity\s*=", re.I)


def _docstring_value_ids(tree: ast.AST) -> set[int]:
    """id()s of Constant nodes that are a module/class/function docstring —
    example markup in documentation is never actually rendered."""
    ids: set[int] = set()
    candidates: list[ast.AST] = [tree]
    candidates.extend(
        n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
    )
    for node in candidates:
        body = getattr(node, "body", None)
        if not body:
            continue
        first = body[0]
        if (
            isinstance(first, ast.Expr)
            and isinstance(first.value, ast.Constant)
            and isinstance(first.value.value, str)
        ):
            ids.add(id(first.value))
    return ids


def _joined_str_text(node: ast.JoinedStr) -> str:
    """Concatenate only the literal quasis — good enough to see the tag shape
    and any integrity= attribute that appears as static markup."""
    parts = []
    for v in node.values:
        if isinstance(v, ast.Constant) and isinstance(v.value, str):
            parts.append(v.value)
        else:
            parts.append("")  # placeholder for an interpolated hole
    return "".join(parts)


class _StringCollector(ast.NodeVisitor):
    """Collects only top-level string-forming nodes — an f-string's literal
    quasis are plain Constant children of its JoinedStr, and walking into
    them separately would double-report the same tag."""

    def __init__(self) -> None:
        self.found: list[ast.AST] = []

    def visit_Constant(self, node: ast.Constant) -> None:
        if isinstance(node.value, str):
            self.found.append(node)

    def visit_JoinedStr(self, node: ast.JoinedStr) -> None:
        self.found.append(node)
        # Deliberately do not call generic_visit — skip descending into quasis.


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []

    docstring_ids = _docstring_value_ids(tree)
    collector = _StringCollector()
    collector.visit(tree)

    for node in collector.found:
        if isinstance(node, ast.Constant):
            if id(node) in docstring_ids:
                continue
            text = node.value
        else:
            text = _joined_str_text(node)

        if not _SCRIPT_SRC_RE.search(text):
            continue
        if _INTEGRITY_RE.search(text):
            continue

        line, col, end_line, end_col = loc(node)
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
