def normalize_scroll(action):
    dx = action.get("dx", 0)
    dy = action.get("dy", 700)
    return {"dx": dx, "dy": dy}
