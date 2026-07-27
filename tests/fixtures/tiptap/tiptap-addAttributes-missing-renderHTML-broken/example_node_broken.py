"""Second node schema with the same asymmetry, in an unrelated field."""

EXAMPLE_NODE_SCHEMA = {
    "name": "example",
    "add_attributes": {
        "label": {
            "default": "example",
            "parse_html": "el => el.getAttribute('data-label')",
        },
    },
}
