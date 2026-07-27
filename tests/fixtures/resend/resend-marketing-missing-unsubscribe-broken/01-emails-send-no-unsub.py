import os
import resend

resend.api_key = os.environ["RESEND_API_KEY"]

# Marketing-tagged email with no unsubscribe header and no placeholder in HTML.
resend.Emails.send(
    {
        "from": "Acme <news@acme.com>",
        "to": ["user@example.com"],
        "subject": "Big Summer Sale",
        "html": "<h1>50% off everything</h1><p>You opted in.</p>",
        "tags": [{"name": "category", "value": "marketing"}],
    }
)
