import os

import websockets

WS_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime"


async def connect():
    return await websockets.connect(
        WS_URL,
        additional_headers={"Authorization": f"Bearer {os.environ.get('OPENAI_API_KEY')}"},
    )
