import os
import resend

resend.api_key = os.environ["RESEND_API_KEY"]


def send_password_reset(user_id: str, email: str, body: str):
    # The subject is fixed, so this function does know its own operation —
    # "password-reset/{user_id}" is derivable. Must still fire.
    return resend.Emails.send({
        "from": "Acme <security@acme.com>",
        "to": email,
        "subject": "Reset your password",
        "html": body,
    })
