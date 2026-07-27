"""Fixed: validate_fn returns bool and its result actually gates the upload."""
from typing import Callable


def handle_file_upload(
    file: bytes,
    on_upload: Callable[[bytes], str],
    validate_fn: Callable[[bytes], bool] = None,
):
    if validate_fn and not validate_fn(file):
        return None
    return on_upload(file)
