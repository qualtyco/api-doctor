import WebSocket from 'ws';

export const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview';

const forwardAudio = (socket: WebSocket, audio: string, logger: any) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio }));
  } else {
    console.error('Socket not open, dropping audio chunk');
  }
};

export default forwardAudio;
