from websockets.protocol import State


async def send_audio_chunk(ws, chunk):
    if ws.state != State.OPEN:
        logger.warning("dropping audio chunk: socket not open")
        return
    await ws.send(chunk)
