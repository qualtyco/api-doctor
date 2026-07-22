import WebSocket from 'ws';

class AudioInterceptor {
  setup(): WebSocket {
    const url = 'wss://api.openai.com/v1/realtime?model=gpt-realtime';
    return new WebSocket(url);
  }
}

export default AudioInterceptor;
