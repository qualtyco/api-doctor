import json


def looks_like_json(message_text):
    # Only checks for presence of a brace, never parses a slice of it.
    return message_text.find("{") != -1


def parse_full_payload(payload):
    # json.loads on the whole string, not a slice — should not be flagged.
    return json.loads(payload)
