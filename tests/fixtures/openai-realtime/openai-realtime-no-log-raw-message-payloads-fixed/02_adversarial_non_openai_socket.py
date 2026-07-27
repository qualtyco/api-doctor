import logging

import websockets

# Adversarial: a different WebSocket entirely, not the OpenAI Realtime API.
OTHER_URL = "wss://example.com/v1/stream"
logger = logging.getLogger(__name__)


async def stream():
    async with websockets.connect(OTHER_URL) as ws:
        async for message in ws:
            logger.info(message)
