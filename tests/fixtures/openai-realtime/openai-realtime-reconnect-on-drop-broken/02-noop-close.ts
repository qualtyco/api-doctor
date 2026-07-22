import WebSocket from 'ws';

class AudioInterceptor {
  #agentOpenAISocket?: WebSocket;
  private closedAt?: number;

  setup() {
    const url = 'wss://api.openai.com/v1/realtime?model=gpt-realtime';
    this.#agentOpenAISocket = new WebSocket(url, { headers: {} });

    this.#agentOpenAISocket.on('close', () => {
      this.closedAt = Date.now();
    });
  }
}

export default AudioInterceptor;
