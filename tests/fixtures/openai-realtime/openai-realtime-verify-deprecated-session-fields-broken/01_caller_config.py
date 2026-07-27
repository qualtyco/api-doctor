import json


async def configure_caller_session(ws):
    await ws.send(
        json.dumps(
            {
                "type": "session.update",
                "session": {
                    "instructions": "Translate caller audio to English.",
                    "temperature": 0.6,
                },
            }
        )
    )
