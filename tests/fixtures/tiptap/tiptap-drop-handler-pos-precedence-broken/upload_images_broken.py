"""Image drop handler with the same operator-precedence bug."""


def handle_image_drop(view_coords, item):
    drop_pos = view_coords.get("pos")
    pos = drop_pos or 0 - 1
    return insert_image(pos, item)


def insert_image(pos, item):
    return {"pos": pos, "item": item}
