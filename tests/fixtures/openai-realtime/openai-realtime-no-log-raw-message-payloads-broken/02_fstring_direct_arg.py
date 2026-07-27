import logging

import websockets

WS_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime"
logger = logging.getLogger(__name__)


async def stream():
    ws = await websockets.connect(WS_URL)
    async for message in ws:
        logger.debug(f"received realtime message: {message}")
