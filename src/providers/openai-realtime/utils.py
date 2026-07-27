"""Shared AST helpers for OpenAI Realtime Python rules (raw `websockets` /
`websocket-client` usage — no `openai` package dependency)."""

from __future__ import annotations

import ast

from ast_utils import attr_chain, string_constants  # noqa: F401 — re-exported for rule modules

REALTIME_URL_SUBSTRING = "api.openai.com/v1/realtime"
CONNECT_CALL_NAMES = frozenset({"connect", "create_connection", "WebSocketApp"})
HEADER_KWARG_NAMES = ("extra_headers", "additional_headers", "headers", "header")


def is_realtime_url_literal(value: str) -> bool:
    return REALTIME_URL_SUBSTRING in value


def is_realtime_url_node(node: ast.AST | None, url_var_names: set[str]) -> bool:
    """True when `node` resolves to the Realtime URL — literal/f-string or a tracked variable."""
    if node is None:
        return False
    for _, value in string_constants(node):
        if is_realtime_url_literal(value):
            return True
    return isinstance(node, ast.Name) and node.id in url_var_names


def collect_realtime_url_var_names(tree: ast.AST) -> set[str]:
    """Local variable names assigned a string/f-string containing the Realtime URL."""
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            for _, value in string_constants(node.value):
                if is_realtime_url_literal(value):
                    names.add(node.targets[0].id)
                    break
    return names


def is_realtime_connect_call(call: ast.AST, url_var_names: set[str]) -> bool:
    """True for `websockets.connect(url, ...)` / `connect(url, ...)` / `create_connection(url, ...)` /
    `WebSocketApp(url, ...)`, resolving simple url variables, where `url` targets the Realtime endpoint."""
    if not isinstance(call, ast.Call):
        return False
    chain = attr_chain(call)
    if not chain or chain[-1] not in CONNECT_CALL_NAMES:
        return False
    if not call.args:
        return False
    return is_realtime_url_node(call.args[0], url_var_names)


def collect_realtime_socket_var_names(tree: ast.AST) -> set[str]:
    """
    Local variable names bound to a Realtime connection, via either:
      - `async with websockets.connect(...) as ws:` / `with ... as ws:`
      - `ws = await websockets.connect(...)` / `ws = websocket.create_connection(...)`
      - `self.socket = websockets.connect(...)` (attribute assignment; tracked by attr name)
    """
    url_var_names = collect_realtime_url_var_names(tree)
    names: set[str] = set()

    for node in ast.walk(tree):
        if isinstance(node, (ast.With, ast.AsyncWith)):
            for item in node.items:
                if (
                    isinstance(item.context_expr, ast.Call)
                    and is_realtime_connect_call(item.context_expr, url_var_names)
                    and isinstance(item.optional_vars, ast.Name)
                ):
                    names.add(item.optional_vars.id)

        elif isinstance(node, ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
            value = node.value
            if isinstance(value, ast.Await):
                value = value.value
            if isinstance(value, ast.Call) and is_realtime_connect_call(value, url_var_names):
                if isinstance(target, ast.Name):
                    names.add(target.id)
                elif isinstance(target, ast.Attribute):
                    names.add(target.attr)

    return names


def is_tracked_socket_ref(node: ast.AST | None, socket_var_names: set[str]) -> bool:
    if isinstance(node, ast.Name):
        return node.id in socket_var_names
    if isinstance(node, ast.Attribute):
        return node.attr in socket_var_names
    return False


def get_headers_arg(call: ast.Call) -> ast.AST | None:
    """The dict/list-of-tuples header argument of a connect call, by common kwarg name."""
    for name in HEADER_KWARG_NAMES:
        for kw in call.keywords:
            if kw.arg == name:
                return kw.value
    return None


def collect_dict_var_values(tree: ast.AST) -> dict[str, ast.Dict]:
    """`name = {...}` dict-literal variable assignments, e.g. `HEADERS = {...}`."""
    values: dict[str, ast.Dict] = {}
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Assign)
            and len(node.targets) == 1
            and isinstance(node.targets[0], ast.Name)
            and isinstance(node.value, ast.Dict)
        ):
            values[node.targets[0].id] = node.value
    return values


def resolve_headers_node(node: ast.AST | None, dict_var_values: dict[str, ast.Dict]) -> ast.AST | None:
    """Resolves a headers argument that is a bare variable reference to its dict literal."""
    if isinstance(node, ast.Name) and node.id in dict_var_values:
        return dict_var_values[node.id]
    return node


def find_header_value(headers_node: ast.AST | None, header_name: str) -> tuple[ast.AST, ast.AST] | None:
    """(key_node, value_node) for `header_name` in a dict or list-of-pairs headers argument."""
    if headers_node is None:
        return None
    if isinstance(headers_node, ast.Dict):
        for k, v in zip(headers_node.keys, headers_node.values):
            if isinstance(k, ast.Constant) and k.value == header_name:
                return k, v
        return None
    if isinstance(headers_node, (ast.List, ast.Tuple)):
        for el in headers_node.elts:
            if isinstance(el, (ast.Tuple, ast.List)) and len(el.elts) == 2:
                key = el.elts[0]
                if isinstance(key, ast.Constant) and key.value == header_name:
                    return el, el.elts[1]
    return None


def literal_string(node: ast.AST | None) -> str | None:
    """Best-effort string from a Constant or f-string with only static parts."""
    if node is None:
        return None
    for _, value in string_constants(node):
        return value
    return None


def _plain_string(node: ast.AST) -> str | None:
    """Strict string literal: Constant, or a template literal with zero expressions."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.JoinedStr) and all(isinstance(v, ast.Constant) for v in node.values):
        return "".join(v.value for v in node.values)  # type: ignore[union-attr]
    return None


def collect_string_var_values(tree: ast.AST) -> dict[str, str]:
    """`name = "<literal>"` / `name = f"<plain f-string, no expressions>"` values."""
    values: dict[str, str] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            s = _plain_string(node.value)
            if s is not None:
                values[node.targets[0].id] = s
    return values


def resolve_string_value(node: ast.AST | None, string_vars: dict[str, str]) -> str | None:
    """Resolves a node to its string value: literal, plain f-string, or a tracked variable."""
    if node is None:
        return None
    s = _plain_string(node)
    if s is not None:
        return s
    if isinstance(node, ast.Name) and node.id in string_vars:
        return string_vars[node.id]
    return None


def dict_get(d: ast.AST, key: str) -> ast.AST | None:
    """Return the value node for a string key in a dict literal, else None."""
    pair = dict_get_pair(d, key)
    return pair[1] if pair else None


def dict_get_pair(d: ast.AST, key: str) -> tuple[ast.AST, ast.AST] | None:
    """Return (key_node, value_node) for a string key in a dict literal, else None."""
    if not isinstance(d, ast.Dict):
        return None
    for k, v in zip(d.keys, d.values):
        if isinstance(k, ast.Constant) and k.value == key:
            return k, v
    return None
