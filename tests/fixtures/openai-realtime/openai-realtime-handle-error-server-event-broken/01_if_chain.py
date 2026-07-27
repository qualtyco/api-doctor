import json

import websockets

WS_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime"


async def stream():
    async with websockets.connect(WS_URL) as ws:
        async for raw in ws:
            event = json.loads(raw)
            if event["type"] == "response.audio.delta":
                play_audio(event["delta"])
            elif event["type"] == "input_audio_buffer.speech_stopped":
                commit_buffer()
