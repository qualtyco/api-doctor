import os
import resend

resend.api_key = os.environ["RESEND_API_KEY"]

# Marketing email that includes the unsubscribe placeholder and header.
resend.Emails.send(
    {
        "from": "Acme <news@acme.com>",
        "to": ["user@example.com"],
        "subject": "Big Summer Sale",
        "html": "<h1>50% off</h1><footer>{{{RESEND_UNSUBSCRIBE_URL}}}</footer>",
        "headers": {
            "List-Unsubscribe": "<https://acme.com/unsubscribe>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        "tags": [{"name": "category", "value": "marketing"}],
    }
)
