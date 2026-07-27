import json

import websockets

WS_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime"


async def stream():
    ws = await websockets.connect(WS_URL)
    async for raw in ws:
        event = json.loads(raw)
        if event.get("type") == "session.created":
            log_session_created(event)
        elif event.get("type") == "response.done":
            finalize_response(event)
