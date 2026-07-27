import os
import resend
resend.api_key = os.environ["RESEND_API_KEY"]
resend.Emails.send({"from": "Acme <a@acme.com>", "to": "u@x.com", "subject": "Hi", "html": "<p>x</p>", "tags": [{"name": "c", "value": "welcome"}], "idempotency_key": "welcome/1"})
