import os
import resend

resend.api_key = os.environ["RESEND_API_KEY"]


def send_all(emails):
    # Literal list — size is statically known; must not flag (JS parity).
    return resend.Batch.send(
        [
            {
                "from": "Acme <a@acme.com>",
                "to": ["a@example.com"],
                "subject": "Hi",
                "html": "<p>x</p>",
            },
            {
                "from": "Acme <a@acme.com>",
                "to": ["b@example.com"],
                "subject": "Hi",
                "html": "<p>x</p>",
            },
        ]
    )


def send_chunked(emails):
    # Loop chunking pattern — must not flag.
    for i in range(0, len(emails), 100):
        chunk = emails[i : i + 100]
        resend.Batch.send(chunk)
