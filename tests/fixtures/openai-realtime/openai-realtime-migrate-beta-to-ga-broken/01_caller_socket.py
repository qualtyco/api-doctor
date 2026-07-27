import asyncio
import os

import websockets

WS_URL = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview"
HEADERS = {
    "Authorization": f"Bearer {os.environ.get('OPENAI_API_KEY')}",
    "OpenAI-Beta": "realtime=v1",
}


async def connect_caller_socket():
    async with websockets.connect(WS_URL, additional_headers=HEADERS) as ws:
        async for message in ws:
            print(message)


asyncio.run(connect_caller_socket())
