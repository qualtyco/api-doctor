import os
import resend

resend.api_key = os.environ["RESEND_API_KEY"]


def send_receipts(orders):
    messages = [
        {
            "from": "Acme <receipts@acme.com>",
            "to": [o["email"]],
            "subject": "Receipt",
            "html": "<p>Receipt</p>",
        }
        for o in orders
    ]
    # Variable array with no len() guard — should flag.
    return resend.Batch.send(messages)
