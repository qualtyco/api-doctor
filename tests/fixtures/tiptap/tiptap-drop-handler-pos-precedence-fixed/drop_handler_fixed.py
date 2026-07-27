"""Fixed: explicit parentheses around the `or` expression."""


def resolve_drop_position(coords):
    pos = (coords.get("pos") or 0) - 1
    return pos
