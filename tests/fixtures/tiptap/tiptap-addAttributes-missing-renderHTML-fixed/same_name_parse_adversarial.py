"""Adversarial: descriptors with no renderHTML that still round-trip cleanly.

Tiptap's default serialization writes `{name: attrs[name]}`, so parsing the
attribute's own name — or not reading the element at all — loses nothing.
"""

LINK_NODE_SCHEMA = {
    "name": "link",
    "add_attributes": {
        # Reads and writes `href`; the parseHTML only normalizes the value.
        "href": {
            "default": None,
            "parseHTML": "el => normalizeLinkHref(el.getAttribute('href'))",
        },
    },
}

IFRAME_NODE_SCHEMA = {
    "name": "iframe",
    "add_attributes": {
        # Ignores the element entirely and returns an option.
        "allowfullscreen": {
            "default": True,
            "parse_html": "() => this.options.allowFullscreen",
        },
        # Opted out of HTML serialization, so there is no round-trip to break.
        "internal_id": {
            "default": None,
            "rendered": False,
            "parseHTML": "el => el.getAttribute('data-internal-id')",
        },
    },
}

CALLOUT_NODE_SCHEMA = {
    "name": "callout",
    "add_attributes": {
        # No per-attribute renderHTML, but the extension's own renderHTML
        # writes the value back under the name parseHTML reads.
        "variant": {
            "default": "info",
            "parseHTML": "el => el.getAttribute('data-variant')",
        },
    },
    "renderHTML": "({ node }) => ['aside', { 'data-variant': node.attrs.variant }, 0]",
}
