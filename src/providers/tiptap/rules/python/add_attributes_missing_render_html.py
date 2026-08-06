"""tiptap-addAttributes-missing-renderHTML (python analog, correctness)

Tiptap's `addAttributes()` descriptors are plain JS objects, so a Python
backend that mirrors the same extension schema as data (e.g. a config file
validated/generated server-side, or a schema shared between a Python CMS and
the Tiptap frontend) uses the identical `parseHTML`/`renderHTML` vocabulary in
a dict literal.

A missing `renderHTML` is not itself the defect. Tiptap's
`getRenderedAttributes` falls back to `{ [name]: attrs[name] }`, so a
descriptor whose `parseHTML` reads the same-named attribute round-trips
correctly. This flags only the asymmetry that actually loses data: a
`parseHTML` reading a *different* name than the one Tiptap writes back, or
reading from somewhere an attribute cannot be written back to at all.

Flags:
    {"label": {"parseHTML": "el => el.getAttribute('data-label')"}}

Does NOT flag:
    {"href": {"parseHTML": "el => normalize(el.getAttribute('href'))"}}
    {"label": {"parseHTML": "...", "renderHTML": "..."}}
"""
from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))

from utils import dict_get_any, dict_has_any, key_name, literal_str, loc  # noqa: E402

RULE_KEY = "tiptap-addAttributes-missing-renderHTML"

# Sources no default attribute serialization can write back, whatever the
# attribute is called. Bracketed so they can never equal a real name.
_STYLE_SOURCE = "<style>"
_CONTENT_SOURCE = "<content>"
_UNKNOWN_SOURCE = "<unknown>"

# The descriptor bodies are JS snippets held as Python strings, so the reads
# have to be recovered from the snippet text rather than from an AST.
_GET_ATTRIBUTE = re.compile(r"\b(?:get|has)Attribute\s*\(\s*['\"]([^'\"]+)['\"]")
_GET_ATTRIBUTE_COMPUTED = re.compile(r"\b(?:get|has)Attribute\s*\(\s*(?!['\"])")
_DATASET = re.compile(r"\.dataset\s*(?:\.([A-Za-z_$][\w$]*)|\[\s*['\"]([^'\"]+)['\"]\s*\])")
_STYLE = re.compile(r"\.style\s*(?:\.[A-Za-z_$]|\[|\.getPropertyValue\s*\()")
_CONTENT = re.compile(r"\.(?:textContent|innerText|innerHTML|outerHTML)\b")


def _dataset_key_to_attribute(key: str) -> str:
    return "data-" + re.sub(r"[A-Z]", lambda m: "-" + m.group(0).lower(), key)


def _read_sources(snippet: str) -> set[str]:
    """Every source name the parseHTML snippet reads, lowercased."""
    sources: set[str] = set()

    for name in _GET_ATTRIBUTE.findall(snippet):
        sources.add(name.lower())
    if _GET_ATTRIBUTE_COMPUTED.search(snippet):
        sources.add(_UNKNOWN_SOURCE)
    for dotted, bracketed in _DATASET.findall(snippet):
        sources.add(_dataset_key_to_attribute(dotted or bracketed).lower())
    if _STYLE.search(snippet):
        sources.add(_STYLE_SOURCE)
    if _CONTENT.search(snippet):
        sources.add(_CONTENT_SOURCE)

    return sources


def _iter_attribute_descriptors(tree: ast.AST):
    """Yields (name, descriptor dict, extension renderHTML) per container."""
    for node in ast.walk(tree):
        if not isinstance(node, ast.Dict):
            continue
        attributes = dict_get_any(node, "addAttributes")
        if not isinstance(attributes, ast.Dict):
            continue
        extension_render_html = literal_str(dict_get_any(node, "renderHTML")) or ""
        for key, value in zip(attributes.keys, attributes.values):
            name = key_name(key)
            if name is not None and isinstance(value, ast.Dict):
                yield name, value, extension_render_html


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []

    for name, descriptor, extension_render_html in _iter_attribute_descriptors(tree):
        parse_html = dict_get_any(descriptor, "parseHTML")
        if parse_html is None or dict_has_any(descriptor, "renderHTML"):
            continue

        # `rendered: false` opts the attribute out of serialization entirely.
        rendered = dict_get_any(descriptor, "rendered")
        if isinstance(rendered, ast.Constant) and rendered.value is False:
            continue

        snippet = literal_str(parse_html)
        if snippet is None:
            continue

        sources = _read_sources(snippet)
        # Nothing read from the DOM, or a name resolvable only at runtime.
        if not sources or _UNKNOWN_SOURCE in sources:
            continue
        # Reading the attribute's own name is what the default write-back emits.
        if name.lower() in sources:
            continue

        # The extension's own renderHTML may write the attribute back by hand,
        # making the per-attribute renderHTML redundant rather than missing.
        if name in extension_render_html or any(s in extension_render_html for s in sources):
            continue

        line, col, end_line, end_col = loc(descriptor)
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
