"""Third-party analytics snippet injected alongside the editor page."""

ANALYTICS_SNIPPET = '<script src="https://analytics.example.com/tracker.js"></script>'


def page_footer() -> str:
    return ANALYTICS_SNIPPET
