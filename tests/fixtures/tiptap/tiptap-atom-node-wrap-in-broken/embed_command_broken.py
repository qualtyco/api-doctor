"""Second atom node with the same broken wrapIn command."""

EMBED_NODE = {"name": "embed", "atom": True, "group": "block"}


def toggle_embed(commands):
    return commands.wrapIn("embed")
