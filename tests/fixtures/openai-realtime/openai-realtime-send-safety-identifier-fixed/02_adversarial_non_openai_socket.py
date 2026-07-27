import websockets

# Adversarial: a non-Realtime WebSocket that also omits the header.
OTHER_URL = "wss://example.com/v1/stream"


async def connect():
    return await websockets.connect(OTHER_URL)
