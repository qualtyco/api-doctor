"""FastAPI upload endpoint mirroring the Tiptap node-view FileUploadOptions shape."""
from typing import Callable


def handle_file_upload(
    file: bytes,
    on_upload: Callable[[bytes], str],
    validate_fn: Callable[[bytes], None] = None,
):
    # validate_fn called as a bare statement — return value silently discarded
    validate_fn(file)
    return on_upload(file)
