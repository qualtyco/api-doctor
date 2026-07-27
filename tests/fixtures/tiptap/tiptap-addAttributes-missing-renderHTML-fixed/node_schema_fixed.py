"""Fixed: the descriptor defines both parseHTML and renderHTML."""

FORMULA_NODE_SCHEMA = {
    "name": "formula",
    "add_attributes": {
        "latex": {
            "default": "",
            "parseHTML": "el => el.getAttribute('data-latex')",
            "renderHTML": "attrs => ({ 'data-latex': attrs.latex })",
        },
    },
}
