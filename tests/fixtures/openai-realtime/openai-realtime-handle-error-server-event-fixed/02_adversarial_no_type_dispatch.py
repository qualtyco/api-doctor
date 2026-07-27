import websockets

# Adversarial: a handler with no message.type branching at all.
WS_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime"


async def stream():
    async with websockets.connect(WS_URL) as ws:
        async for raw in ws:
            append_to_transcript_log(raw)
