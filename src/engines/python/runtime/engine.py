"""
api-doctor Python rule runtime (stdlib only).

Discovers provider rules under <providers-root>/<name>/rules/python/,
parses each target file with ast.parse, and emits JSON diagnostics on stdout.
"""

from __future__ import annotations

import argparse
import ast
import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType
from typing import Any, Callable

Diagnostic = dict[str, Any]
CheckFn = Callable[[ast.AST, str, str], list[Diagnostic]]


def _load_module(path: Path) -> ModuleType | None:
    spec = importlib.util.spec_from_file_location(path.stem, path)
    if spec is None or spec.loader is None:
        return None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def discover_rules(providers_root: Path, enabled: set[str]) -> dict[str, CheckFn]:
    found: dict[str, CheckFn] = {}
    if not providers_root.is_dir():
        return found

    for provider_dir in sorted(providers_root.iterdir()):
        py_rules = provider_dir / "rules" / "python"
        if not py_rules.is_dir():
            continue
        parent = str(provider_dir)
        if parent not in sys.path:
            sys.path.insert(0, parent)

        # Every provider's shared helper module is conventionally named
        # `utils.py`. Rule files do `from utils import ...`, and Python
        # caches that resolution in sys.modules by the bare name "utils" —
        # without swapping the cache entry per provider, the second
        # provider processed here would silently reuse the first
        # provider's utils module (or fail importing names that don't
        # exist there). Load this provider's utils.py (if any) under the
        # "utils" key, then restore whatever was cached before we started
        # so later providers aren't affected either.
        utils_path = provider_dir / "utils.py"
        prev_utils = sys.modules.pop("utils", None)
        if utils_path.is_file():
            utils_mod = _load_module(utils_path)
            if utils_mod is not None:
                sys.modules["utils"] = utils_mod

        try:
            for path in sorted(py_rules.glob("*.py")):
                if path.name.startswith("_"):
                    continue
                mod = _load_module(path)
                if mod is None:
                    continue
                rule_key = getattr(mod, "RULE_KEY", None)
                check = getattr(mod, "check", None)
                if isinstance(rule_key, str) and callable(check) and rule_key in enabled:
                    found[rule_key] = check
        finally:
            sys.modules.pop("utils", None)
            if prev_utils is not None:
                sys.modules["utils"] = prev_utils
    return found


def analyze_file(rel_path: str, source: str, rules: dict[str, CheckFn]) -> list[Diagnostic]:
    try:
        tree = ast.parse(source, filename=rel_path)
    except SyntaxError:
        return []

    out: list[Diagnostic] = []
    for rule_key, check in rules.items():
        try:
            diags = check(tree, rel_path, source) or []
        except Exception as exc:  # noqa: BLE001
            print(f"api-doctor python rule {rule_key} failed on {rel_path}: {exc}", file=sys.stderr)
            continue
        for d in diags:
            d.setdefault("ruleKey", rule_key)
            d.setdefault("file", rel_path)
            out.append(d)
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="api-doctor-python-runtime")
    parser.add_argument("--files-json", required=True)
    parser.add_argument("--rules", required=True)
    parser.add_argument("--providers-root", required=True)
    args = parser.parse_args(argv)

    payload = json.loads(Path(args.files_json).read_text(encoding="utf-8"))
    root = Path(payload["root"])
    files: list[str] = list(payload.get("files") or [])
    enabled = {k.strip() for k in args.rules.split(",") if k.strip()}
    providers_root = Path(args.providers_root)

    runtime_dir = Path(__file__).resolve().parent
    if str(runtime_dir) not in sys.path:
        sys.path.insert(0, str(runtime_dir))

    rules = discover_rules(providers_root, enabled)
    diagnostics: list[Diagnostic] = []
    for rel in files:
        path = root / rel
        try:
            source = path.read_text(encoding="utf-8")
        except OSError:
            continue
        diagnostics.extend(analyze_file(rel, source, rules))

    json.dump(diagnostics, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
