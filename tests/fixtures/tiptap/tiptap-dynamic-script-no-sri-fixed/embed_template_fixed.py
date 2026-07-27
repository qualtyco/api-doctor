"""Server-rendered HTML embedding the Tiptap CDN script with an SRI hash."""
import os


def render_editor_embed():
    api_key = os.environ["TIPTAP_API_KEY"]
    return (
        f'<div id="editor"></div><script src="https://cdn.tiptap.dev/embed.js?apiKey={api_key}" '
        'integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC" '
        'crossorigin="anonymous"></script>'
    )
