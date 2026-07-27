import os
import resend

resend.api_key = os.environ["RESEND_API_KEY"]

# Newsletter-tagged batch items, none carrying an unsubscribe mechanism.
resend.Batch.send(
    [
        {
            "from": "Acme <news@acme.com>",
            "to": ["a@example.com"],
            "subject": "This week at Acme",
            "html": "<p>Newsletter content</p>",
            "tags": [{"name": "type", "value": "newsletter"}],
        },
        {
            "from": "Acme <news@acme.com>",
            "to": ["b@example.com"],
            "subject": "This week at Acme",
            "html": "<p>Newsletter content</p>",
            "tags": [{"name": "type", "value": "newsletter"}],
        },
    ]
)
