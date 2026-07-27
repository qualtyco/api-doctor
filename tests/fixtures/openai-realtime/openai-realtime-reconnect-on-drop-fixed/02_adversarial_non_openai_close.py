import logging

import websockets
from websockets.exceptions import ConnectionClosed

# Adversarial: a log-only close handler on a non-Realtime socket.
OTHER_URL = "wss://example.com/v1/stream"
logger = logging.getLogger(__name__)


async def stream():
    try:
        async with websockets.connect(OTHER_URL) as ws:
            async for message in ws:
                handle_message(message)
    except ConnectionClosed as exc:
        logger.error("socket closed: %s", exc)
