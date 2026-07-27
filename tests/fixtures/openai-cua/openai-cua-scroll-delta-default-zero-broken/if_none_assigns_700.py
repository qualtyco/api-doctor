def normalize_scroll(action):
    scroll_y = action.get("scroll_y")
    if scroll_y is None:
        scroll_y = 700
    return scroll_y
