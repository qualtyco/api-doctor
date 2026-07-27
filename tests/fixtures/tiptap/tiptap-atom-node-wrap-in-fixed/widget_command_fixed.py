"""Fixed: the atom node is replaced with replaceSelectionWith instead of wrapIn."""

WIDGET_NODE = {"name": "widget", "group": "block", "atom": True}


def toggle_widget(commands, selection, node_type):
    return commands.replace_selection_with(node_type.create())
