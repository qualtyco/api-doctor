import json


def build_agent_session_update():
    return json.dumps(
        {
            "type": "session.update",
            "session": {
                "audio": {
                    "input": {
                        "transcription": {"model": "whisper-1"},
                    },
                },
            },
        }
    )
