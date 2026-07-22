import WebSocket from 'ws';

class AudioInterceptor {
  #callerOpenAISocket?: WebSocket;

  setup() {
    const url = 'wss://api.openai.com/v1/realtime?model=gpt-realtime';
    this.#callerOpenAISocket = new WebSocket(url, { headers: {} });

    this.#callerOpenAISocket.on('close', () => {
      this.reconnectCallerSocket();
    });
  }

  reconnectCallerSocket() {}
}

export default AudioInterceptor;
