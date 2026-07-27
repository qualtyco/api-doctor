import json


def build_agent_session_update():
    return json.dumps(
        {
            "type": "session.update",
            "session": {
                "voice": "alloy",
                "temperature": 0.8,
                "turn_detection": {"type": "server_vad"},
            },
        }
    )
