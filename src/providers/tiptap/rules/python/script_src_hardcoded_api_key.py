"""tiptap-script-src-hardcoded-api-key (python analog, security)

Tiptap itself has no Python SDK, but Python backends that server-render HTML
embedding a Tiptap-hosted widget (e.g. the desmos/calculator node-view CDN
script) build the same `<script src="...?apiKey=...">` URL pattern. This
mirrors the JS rule: flag a `src=` assignment/keyword/dict-value whose string
(plain or f-string) contains a hardcoded `apiKey=`/`api_key=` value instead of
reading it from `os.environ`/`os.getenv`.

Flags:
    script.src = "https://cdn.example.com/embed.js?apiKey=abc123"
    Script(src=f"https://cdn.example.com/embed.js?apiKey={API_KEY}")  # API_KEY is a literal
    config["src"] = "...?api_key=abc123"

Does NOT flag:
    script.src = f"https://cdn.example.com/embed.js?apiKey={os.environ['API_KEY']}"
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))

from utils import is_env_access, key_name, loc  # noqa: E402

RULE_KEY = "tiptap-script-src-hardcoded-api-key"

_KEY_MARKERS = ("apiKey=", "api_key=")


def _has_hardcoded_key(node: ast.AST | None) -> bool:
    """Mirrors the JS quasi-walk: text before the marker is enough evidence,
    unless the value immediately following the marker is an env lookup."""
    if node is None:
        return False

    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return any(marker in node.value for marker in _KEY_MARKERS)

    if isinstance(node, ast.JoinedStr):
        values = node.values
        for i, part in enumerate(values):
            if not (isinstance(part, ast.Constant) and isinstance(part.value, str)):
                continue
            if not any(marker in part.value for marker in _KEY_MARKERS):
                continue
            # Marker text found in this literal chunk — check whether the very
            # next interpolated expression is an env lookup.
            next_expr = values[i + 1] if i + 1 < len(values) else None
            if isinstance(next_expr, ast.FormattedValue):
                if is_env_access(next_expr.value):
                    continue
                return True
            # Marker is in a tail chunk (or immediately followed by another
            # literal chunk) with no env-access expression right after it.
            return True
        return False

    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        return _has_hardcoded_key(node.left) or _has_hardcoded_key(node.right)

    return False


def _is_src_target(target: ast.AST) -> bool:
    if isinstance(target, ast.Attribute) and target.attr == "src":
        return True
    if isinstance(target, ast.Subscript):
        sl = target.slice
        return isinstance(sl, ast.Constant) and sl.value == "src"
    return False


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []

    for node in ast.walk(tree):
        # obj.src = "..."
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if _is_src_target(target) and _has_hardcoded_key(node.value):
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
        elif isinstance(node, ast.AnnAssign) and node.value is not None:
            if _is_src_target(node.target) and _has_hardcoded_key(node.value):
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

        # {"src": "..."} dict literal (config-driven node views / SSR templates)
        elif isinstance(node, ast.Dict):
            for k, v in zip(node.keys, node.values):
                if key_name(k) == "src" and _has_hardcoded_key(v):
                    line, col, end_line, end_col = loc(v)
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

        # Script(src="...") / tag.script(src="...") keyword-argument HTML builders
        elif isinstance(node, ast.Call):
            for kw in node.keywords:
                if kw.arg == "src" and _has_hardcoded_key(kw.value):
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
