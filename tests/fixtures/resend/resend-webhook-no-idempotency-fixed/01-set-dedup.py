import os
from flask import Flask, request
from svix.webhooks import Webhook

app = Flask(__name__)
wh = Webhook(os.environ["RESEND_WEBHOOK_SECRET"])
processed = set()


@app.route("/webhook", methods=["POST"])
def handle_webhook():
    payload = request.get_data(as_text=True)
    event = wh.verify(
        payload,
        {
            "svix-id": request.headers.get("svix-id"),
            "svix-timestamp": request.headers.get("svix-timestamp"),
            "svix-signature": request.headers.get("svix-signature"),
        },
    )
    email_id = event.get("data", {}).get("email_id")
    if email_id in processed:
        return {"duplicate": True}
    processed.add(email_id)
    return {"ok": True}
