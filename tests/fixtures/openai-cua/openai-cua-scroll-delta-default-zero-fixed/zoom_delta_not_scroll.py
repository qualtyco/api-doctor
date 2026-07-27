def normalize_zoom(action):
    # Not a scroll delta at all — should not be flagged.
    zoom_delta = action.get("zoom_delta", 700)
    return zoom_delta
