"""Image upload plugin for a Python-backed editor node, mirroring the JS options shape."""


def create_image_upload(validate_fn, on_upload):
    def upload(file):
        if not file.content_type.startswith("image/"):
            print("Not an image")
        # Return value is discarded — file validation never blocks uploads
        validate_fn(file)
        return on_upload(file)

    return upload
