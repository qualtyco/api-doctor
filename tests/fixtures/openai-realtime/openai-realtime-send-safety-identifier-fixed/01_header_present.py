import os

import websockets

WS_URL = "wss://api.openai.com/v1/realtime?model=gpt-realtime"


async def connect(hashed_account_id):
    return await websockets.connect(
        WS_URL,
        additional_headers={
            "Authorization": f"Bearer {os.environ.get('OPENAI_API_KEY')}",
            "OpenAI-Safety-Identifier": hashed_account_id,
        },
    )
