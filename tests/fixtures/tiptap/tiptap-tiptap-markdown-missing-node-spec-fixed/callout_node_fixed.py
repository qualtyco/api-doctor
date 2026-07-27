"""Fixed: the node registration includes a markdown serialization spec."""
import tiptap_bridge
import markdown

CALLOUT_NODE = {
    "name": "callout",
    "group": "block",
    "content": "block+",
    "markdown": {
        "serialize": lambda state, node: state.write(f"> {node.text_content}\n"),
    },
}
