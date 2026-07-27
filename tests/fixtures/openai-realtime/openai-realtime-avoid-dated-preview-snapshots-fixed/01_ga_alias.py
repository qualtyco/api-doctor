import websockets


def setup(api_key):
    ws_url = f"wss://api.openai.com/v1/realtime?model=gpt-realtime"
    return websockets.connect(ws_url, additional_headers={"Authorization": f"Bearer {api_key}"})
