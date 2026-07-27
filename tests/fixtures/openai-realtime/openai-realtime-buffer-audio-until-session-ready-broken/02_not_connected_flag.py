class TwilioBridge:
    def __init__(self):
        self.connected = False

    def on_media(self, chunk):
        if not self.connected:
            return
        self.forward_to_openai(chunk)
