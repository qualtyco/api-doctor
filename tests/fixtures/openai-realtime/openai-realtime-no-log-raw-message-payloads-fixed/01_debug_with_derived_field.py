import json
import logging

import websockets

WS_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime"
logger = logging.getLogger(__name__)


async def stream():
    async with websockets.connect(WS_URL) as ws:
        async for message in ws:
            event = json.loads(message)
            logger.info("received event type=%s", event.get("type"))
