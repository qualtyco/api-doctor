"""Adversarial: wrapIn is called with a node name that is NOT an atom."""

CONTAINER_NODE = {"name": "container", "group": "block", "content": "block+"}
WIDGET_NODE = {"name": "widget", "atom": True}


def toggle_container(commands):
    return commands.wrap_in("container")
