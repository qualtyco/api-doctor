"""Adversarial: processing helper + stringified Flask example that mentions verify.

Must not flag — there is no real POST handler AST, and verify only appears in a string.
"""
import os
import resend

resend.api_key = os.environ["RESEND_API_KEY"]


def process_double_optin_webhook(event: dict) -> dict:
    """Process an already-verified webhook event."""
    if event.get("type") != "email.clicked":
        return {"received": True, "message": "ignored"}
    return {"received": True, "confirmed": True}


if __name__ == "__main__":
    print(
        """
@app.route("/double-optin/webhook", methods=["POST"])
def double_optin_webhook():
    payload = request.get_data(as_text=True)
    resend.Webhooks.verify({
        "payload": payload,
        "headers": {
            "id": request.headers.get("svix-id"),
            "timestamp": request.headers.get("svix-timestamp"),
            "signature": request.headers.get("svix-signature"),
        },
        "webhook_secret": os.environ["RESEND_WEBHOOK_SECRET"],
    })
    event = json.loads(payload)
    return process_double_optin_webhook(event)
"""
    )
