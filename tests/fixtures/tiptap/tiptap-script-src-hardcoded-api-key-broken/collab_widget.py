"""Server-side node-view descriptor for an embedded widget, built as plain data."""


class ScriptTag:
    def __init__(self):
        self.async_ = True

    def build(self):
        self.src = f"https://cdn.example.com/widget.js?apiKey=abc123def456"
        return self
