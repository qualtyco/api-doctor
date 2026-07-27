# Adversarial: "whisper-1" inside a non-session.update payload.
def build_batch_transcription_request():
    return {
        "type": "audio.transcriptions.create",
        "model": "whisper-1",
    }
