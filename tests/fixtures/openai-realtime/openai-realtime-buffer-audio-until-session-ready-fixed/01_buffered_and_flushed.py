from websockets.protocol import State


async def send_audio_chunk(ws, chunk, pending_audio_queue):
    if ws.state != State.OPEN:
        pending_audio_queue.append(chunk)
        return
    await ws.send(chunk)
