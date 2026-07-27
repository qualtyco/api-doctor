import os

import websockets

WS_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime"


async def connect_caller_socket():
    async with websockets.connect(
        WS_URL,
        additional_headers={
            "Authorization": f"Bearer {os.environ.get('OPENAI_API_KEY')}",
        },
    ) as ws:
        async for message in ws:
            print(message.get("type"))
