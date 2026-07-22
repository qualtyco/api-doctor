import WebSocket from 'ws';

class AudioInterceptor {
  setup(apiKey: string): WebSocket {
    return new WebSocket(
      'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2025-06-03',
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
  }
}

export default AudioInterceptor;
