import websockets


def setup(api_key):
    ws_url = f"wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01"
    return websockets.connect(ws_url, additional_headers={"Authorization": f"Bearer {api_key}"})
