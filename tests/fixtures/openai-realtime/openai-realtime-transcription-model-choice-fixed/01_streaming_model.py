import json


async def configure_caller_session(ws):
    await ws.send(
        json.dumps(
            {
                "type": "session.update",
                "session": {
                    "input_audio_transcription": {"model": "gpt-realtime-whisper"},
                },
            }
        )
    )
