"""openai-realtime-transcription-model-choice

Parity with the JS rule: `input_audio_transcription` (or the GA
`audio.input.transcription`) configured with `whisper-1` is not natively
streaming and not optimized for realtime sessions.
"""
from __future__ import annotations

import ast
import sys
from pathlib import Path

from ast_utils import loc

_PROVIDER = Path(__file__).resolve().parents[2]
if str(_PROVIDER) not in sys.path:
    sys.path.insert(0, str(_PROVIDER))
from utils import dict_get  # noqa: E402

RULE_KEY = "openai-realtime-transcription-model-choice"


def check(tree: ast.AST, path: str, source: str) -> list[dict]:
    out: list[dict] = []

    for node in ast.walk(tree):
        if not isinstance(node, ast.Dict):
            continue
        type_val = dict_get(node, "type")
        if not (isinstance(type_val, ast.Constant) and type_val.value == "session.update"):
            continue

        session_val = dict_get(node, "session")
        if not isinstance(session_val, ast.Dict):
            continue

        # Legacy/beta shape: session.input_audio_transcription
        transcription_val = dict_get(session_val, "input_audio_transcription")
        if not isinstance(transcription_val, ast.Dict):
            # GA shape: session.audio.input.transcription
            audio_val = dict_get(session_val, "audio")
            input_val = dict_get(audio_val, "input") if isinstance(audio_val, ast.Dict) else None
            transcription_val = dict_get(input_val, "transcription") if isinstance(input_val, ast.Dict) else None
        if not isinstance(transcription_val, ast.Dict):
            continue

        model_val = dict_get(transcription_val, "model")
        if isinstance(model_val, ast.Constant) and model_val.value == "whisper-1":
            line, col, _, _ = loc(model_val)
            out.append({"file": path, "line": line, "column": col, "ruleKey": RULE_KEY})

    return out
