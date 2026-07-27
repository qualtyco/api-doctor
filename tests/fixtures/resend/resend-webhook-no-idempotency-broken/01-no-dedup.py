import os
from flask import Flask, request
from svix.webhooks import Webhook

app = Flask(__name__)
wh = Webhook(os.environ["RESEND_WEBHOOK_SECRET"])


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
    # Processes every delivery with no deduplication.
    if event.get("type") == "email.delivered":
        print("delivered")
    return {"ok": True}
