import WebSocket from 'ws';

export const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview';

// Distinct manifestation: the readyState !== OPEN early-return shape — audio
// arriving before the socket opens is logged and dropped, never buffered.
function forwardAudio(socket: WebSocket, audio: string, logger: any) {
  if (socket.readyState !== WebSocket.OPEN) {
    logger.warn('Socket not open yet, skipping audio chunk');
    return;
  }
  socket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio }));
}

export default forwardAudio;
