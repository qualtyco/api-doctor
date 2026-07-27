"""Adversarial: validate_fn's return value is captured and used, not discarded."""


def create_image_upload(validate_fn, on_upload):
    def upload(file):
        is_valid = validate_fn(file)
        if not is_valid:
            return None
        return on_upload(file)

    return upload
