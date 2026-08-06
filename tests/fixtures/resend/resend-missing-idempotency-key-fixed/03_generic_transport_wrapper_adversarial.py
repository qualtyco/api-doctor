import os
import resend

resend.api_key = os.environ["RESEND_API_KEY"]


def send_email(to: str, subject: str, html: str):
    # Subject and body are both caller-supplied: this function cannot name the
    # operation it performs, so no key is derivable here.
    return resend.Emails.send({"from": "Acme <a@acme.com>", "to": to, "subject": subject, "html": html})
