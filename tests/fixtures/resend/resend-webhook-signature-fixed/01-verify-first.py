import json
import os
import resend
from flask import Flask, jsonify, request

app = Flask(__name__)
resend.api_key = os.environ["RESEND_API_KEY"]


@app.route("/webhook", methods=["POST"])
def handle_webhook():
    payload = request.get_data(as_text=True)
    resend.Webhooks.verify(
        {
            "payload": payload,
            "headers": {
                "id": request.headers.get("svix-id"),
                "timestamp": request.headers.get("svix-timestamp"),
                "signature": request.headers.get("svix-signature"),
            },
            "webhook_secret": os.environ["RESEND_WEBHOOK_SECRET"],
        }
    )
    event = json.loads(payload)
    return jsonify({"received": True, "type": event.get("type")})
