import json


def extract_step_metadata(message_text):
    start = message_text.find("{")
    end = message_text.rfind("}")
    return json.loads(message_text[start : end + 1])
