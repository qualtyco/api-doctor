"""tiptap-upload-validate-fn-void (python analog, security)

Mirrors the JS rule's two patterns for a Tiptap-style upload config
(`validate_fn` / `validateFn` alongside `on_upload` / `onUpload`), which shows
up in Python backends that reimplement the same node-view upload contract
(e.g. a FastAPI/Flask endpoint mirroring the JS `FileUploadOptions` shape):

(a) A function whose `validate_fn` parameter is annotated to return `None`
    (e.g. `Callable[[UploadFile], None]`) while an `on_upload` parameter also
    exists — the void return type means a caller can never act on the
    validation result.
(b) A bare expression statement that calls `validate_fn(...)` (or
    `validate_fn?.(...)`-style optional call via `and`), discarding the
    return value.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))

from utils import func_or_method_name, loc  # noqa: E402

RULE_KEY = "tiptap-upload-validate-fn-void"

_VALIDATE_FN_NAMES = frozenset({"validate_fn", "validateFn"})
_ON_UPLOAD_NAMES = frozenset({"on_upload", "onUpload"})


def _annotation_returns_none(annotation: ast.AST | None) -> bool:
    """True for `Callable[[...], None]`-shaped annotations."""
    if not isinstance(annotation, ast.Subscript):
        return False
    base = annotation.value
    base_name = base.id if isinstance(base, ast.Name) else getattr(base, "attr", None)
    if base_name != "Callable":
        return False
    sl = annotation.slice
    # Callable[[Arg], Ret] -> slice is a Tuple([List, Ret])
    if isinstance(sl, ast.Tuple) and len(sl.elts) == 2:
        ret = sl.elts[1]
        return isinstance(ret, ast.Constant) and ret.value is None
    return False


def _check_function(fn: ast.FunctionDef | ast.AsyncFunctionDef) -> list[ast.arg]:
    args = fn.args
    all_args = [*args.posonlyargs, *args.args, args.vararg, *args.kwonlyargs, args.kwarg]
    all_args = [a for a in all_args if a is not None]

    names = {a.arg for a in all_args}
    if not (names & _ON_UPLOAD_NAMES):
        return []

    hits = []
    for a in all_args:
        if a.arg in _VALIDATE_FN_NAMES and _annotation_returns_none(a.annotation):
            hits.append(a)
    return hits


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for arg in _check_function(node):
                line, col, end_line, end_col = loc(arg)
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

        elif isinstance(node, ast.Expr):
            call = node.value
            # `validate_fn(file)` or `validate_fn and validate_fn(file)`
            if isinstance(call, ast.BoolOp) and isinstance(call.op, ast.And):
                call = call.values[-1] if call.values else None
            if (
                isinstance(call, ast.Call)
                and func_or_method_name(call.func) in _VALIDATE_FN_NAMES
            ):
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
