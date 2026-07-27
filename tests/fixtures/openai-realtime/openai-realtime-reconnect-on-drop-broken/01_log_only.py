import logging

import websockets
from websockets.exceptions import ConnectionClosed

WS_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime"
logger = logging.getLogger(__name__)


async def stream():
    try:
        async with websockets.connect(WS_URL) as ws:
            async for message in ws:
                handle_message(message)
    except ConnectionClosed as exc:
        logger.error("realtime socket closed: %s", exc)
