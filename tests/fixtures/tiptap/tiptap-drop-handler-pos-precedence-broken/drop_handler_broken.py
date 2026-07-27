"""Server-side drop-position resolver ported from a ProseMirror posAtCoords callback."""


def resolve_drop_position(coords):
    # Same precedence bug as JS: pos or (0 - 1) = pos or -1, not (pos or 0) - 1
    pos = coords.get("pos") or 0 - 1
    return pos
