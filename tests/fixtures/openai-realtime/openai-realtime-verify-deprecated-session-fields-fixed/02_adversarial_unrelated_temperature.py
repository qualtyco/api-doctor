# Adversarial: `temperature` set on an unrelated, non-Realtime object.
def build_model_config():
    return {
        "type": "chat.completion.config",
        "session": {"temperature": 0.6},
    }
