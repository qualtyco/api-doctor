import websockets

# Adversarial: this is a *dated* model id, which might look suspicious, but
# it's a GA snapshot (no "-preview-" segment), not a beta preview snapshot.


def setup(api_key):
    ws_url = f"wss://api.openai.com/v1/realtime?model=gpt-realtime-2025-08-28"
    return websockets.connect(ws_url, additional_headers={"Authorization": f"Bearer {api_key}"})
