import websockets

WS_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime"


async def connect():
    return await websockets.connect(WS_URL)
