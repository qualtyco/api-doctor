import os
import resend
from flask import Flask, jsonify, request

app = Flask(__name__)
resend.api_key = os.environ["RESEND_API_KEY"]


@app.route("/batch", methods=["POST"])
def send_batch():
    emails = request.get_json()["emails"]
    # Variable array with no len() guard — should flag.
    result = resend.Batch.send(emails)
    return jsonify(result)
