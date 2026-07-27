import websockets

# Adversarial: a third-party socket reusing the "OpenAI-Beta" header name,
# but not connecting to the OpenAI Realtime endpoint.
OTHER_URL = "wss://example.com/v1/stream"


async def connect_other_socket():
    async with websockets.connect(
        OTHER_URL,
        additional_headers={"OpenAI-Beta": "realtime=v1"},
    ) as ws:
        pass
