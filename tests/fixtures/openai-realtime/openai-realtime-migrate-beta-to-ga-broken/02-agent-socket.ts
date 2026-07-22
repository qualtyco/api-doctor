import WebSocket from 'ws';

class AudioInterceptor {
  private agentOpenAISocket?: WebSocket;

  setup(apiKey: string) {
    const url = 'wss://api.openai.com/v1/realtime?model=gpt-realtime';
    this.agentOpenAISocket = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });
  }
}

export default AudioInterceptor;
