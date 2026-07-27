import os

import websockets

AGENT_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime"


async def connect_agent_socket():
    agent_ws = await websockets.connect(
        AGENT_URL,
        additional_headers={
            "Authorization": f"Bearer {os.environ.get('OPENAI_API_KEY')}",
            "OpenAI-Beta": "realtime=v1",
        },
    )
    return agent_ws
