import WebSocket from 'ws';

class AudioInterceptor {
  #agentOpenAISocket?: WebSocket;
  private logger: any;

  setup() {
    const url = 'wss://api.openai.com/v1/realtime?model=gpt-realtime';
    this.#agentOpenAISocket = new WebSocket(url, { headers: {} });

    this.#agentOpenAISocket.on('message', (msg) => {
      this.logger.info(msg.toString());
    });
  }
}

export default AudioInterceptor;
