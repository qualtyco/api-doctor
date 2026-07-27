"""Adversarial: `or` used correctly with no arithmetic to trip precedence over."""


def resolve_drop_position(coords):
    pos = coords.get("pos") or 0
    return pos


def resolve_with_default(a, b):
    return a or b - 1
