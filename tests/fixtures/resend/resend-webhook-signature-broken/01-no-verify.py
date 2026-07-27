import os
import resend
from flask import Flask, jsonify, request

app = Flask(__name__)
resend.api_key = os.environ["RESEND_API_KEY"]


@app.route("/webhook", methods=["POST"])
def handle_webhook():
    # Parses the body without verifying the Svix signature first.
    event = request.get_json()
    print(event.get("type"))
    return jsonify({"received": True})
