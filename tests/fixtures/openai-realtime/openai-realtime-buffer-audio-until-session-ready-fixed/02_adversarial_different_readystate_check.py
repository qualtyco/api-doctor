from websockets.protocol import State

# Adversarial: a readyState check against CLOSED, not OPEN — out of scope for
# this rule (it targets the OPEN-gated buffering pattern specifically).


async def send_audio_chunk(ws, chunk):
    if ws.state == State.CLOSED:
        logger.warning("socket closed, dropping chunk")
        return
    await ws.send(chunk)
