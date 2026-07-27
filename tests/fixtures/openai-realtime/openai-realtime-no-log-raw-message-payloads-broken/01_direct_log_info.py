import logging

import websockets

WS_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime"
logger = logging.getLogger(__name__)


async def stream():
    async with websockets.connect(WS_URL) as ws:
        async for message in ws:
            logger.info(message)
