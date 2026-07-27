"""Server-rendered HTML embedding the Tiptap CDN script with no SRI hash."""
import os


def render_editor_embed():
    api_key = os.environ["TIPTAP_API_KEY"]
    return f'<div id="editor"></div><script src="https://cdn.tiptap.dev/embed.js?apiKey={api_key}"></script>'
