import websockets

WS_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime"


async def stream():
    ws = await websockets.connect(WS_URL)
    try:
        async for message in ws:
            handle_message(message)
    except websockets.exceptions.ConnectionClosedError:
        pass
