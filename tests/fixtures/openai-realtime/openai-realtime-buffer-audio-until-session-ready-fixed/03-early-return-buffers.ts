import WebSocket from 'ws';

// The readyState !== OPEN early-return shape, but the not-yet-open branch
// buffers the chunk for a later flush instead of dropping it.
const pendingChunks: string[] = [];

function forwardAudio(socket: WebSocket, audio: string) {
  if (socket.readyState !== WebSocket.OPEN) {
    pendingChunks.push(audio);
    return;
  }
  socket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio }));
}

export default forwardAudio;
