from urllib.parse import urlparse

ALLOWED_DOMAINS = {"example.com", "app.example.com"}


def handle_action(page, action):
    hostname = urlparse(page.url).hostname
    if hostname not in ALLOWED_DOMAINS:
        raise ValueError(f"Blocked action on untrusted domain: {hostname}")
    if action["type"] == "click":
        page.click(action["x"], action["y"])
