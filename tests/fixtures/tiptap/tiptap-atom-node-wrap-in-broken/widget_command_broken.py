"""Server-side command dispatcher mirroring editor commands defined in the
shared node registry, including a broken wrapIn on an atom node."""

WIDGET_NODE = {"name": "widget", "group": "block", "atom": True}


def toggle_widget(commands, selection):
    if selection.empty:
        return commands.insert_content({"type": "widget"})
    # wrapIn with an atom node always returns false silently
    return commands.wrap_in("widget")
