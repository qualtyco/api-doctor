import websockets


class AudioInterceptor:
    def setup(self, api_key):
        return websockets.connect(
            "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2025-06-03",
            additional_headers={"Authorization": f"Bearer {api_key}"},
        )
