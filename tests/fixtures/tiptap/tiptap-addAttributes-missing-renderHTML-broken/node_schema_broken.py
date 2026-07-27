"""Shared node-attribute schema, mirrored server-side so a CMS can validate
editor payloads against the same Tiptap extension descriptors."""

FORMULA_NODE_SCHEMA = {
    "name": "formula",
    "add_attributes": {
        "latex": {
            "default": "",
            "parseHTML": "el => el.getAttribute('data-latex')",
        },
    },
}
