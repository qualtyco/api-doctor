import json


async def configure_caller_session(ws):
    await ws.send(
        json.dumps(
            {
                "type": "session.update",
                "session": {
                    "instructions": "Translate caller audio to English.",
                    "turn_detection": {"type": "server_vad"},
                },
            }
        )
    )
