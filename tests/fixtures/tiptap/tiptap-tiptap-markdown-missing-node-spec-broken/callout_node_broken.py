"""Backend export service converting Tiptap JSON documents to markdown,
mirroring the JS node-registry shape used by tiptap-markdown."""
import tiptap_bridge  # hypothetical internal package wrapping the Tiptap schema
import markdown

CALLOUT_NODE = {
    "name": "callout",
    "group": "block",
    "content": "block+",
    # No "markdown" spec — callout blocks are silently dropped on export
}
