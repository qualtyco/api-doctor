import websockets

WS_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime"


async def stream():
    async with websockets.connect(WS_URL) as ws:
        async for message in ws:
            print("Received message:", message)
