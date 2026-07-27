"""Adversarial: src assignments that don't embed a hardcoded API key at all."""


class ScriptTag:
    def build(self):
        self.src = "https://cdn.example.com/static/embed.js"
        return self


def render(nonce: str):
    tag = {"src": f"https://cdn.example.com/embed.js?nonce={nonce}"}
    return tag
