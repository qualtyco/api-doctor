import os
import resend

resend.api_key = os.environ["RESEND_API_KEY"]

# Adversarial: transactional welcome email (and HTML that mentions "newsletter")
# with no unsubscribe. Must not flag — only marketing tags trigger the rule.
resend.Emails.send(
    {
        "from": "Acme <onboarding@acme.com>",
        "to": ["user@example.com"],
        "subject": "Welcome to Acme",
        "html": "<p>Welcome aboard! Confirm your newsletter waitlist separately.</p>",
        "tags": [{"name": "category", "value": "welcome"}],
    }
)
