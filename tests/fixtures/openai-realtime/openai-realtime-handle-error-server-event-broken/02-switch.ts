import WebSocket from 'ws';

class AudioInterceptor {
  #agentOpenAISocket?: WebSocket;

  setup() {
    const url = 'wss://api.openai.com/v1/realtime?model=gpt-realtime';
    this.#agentOpenAISocket = new WebSocket(url, { headers: {} });

    this.#agentOpenAISocket.on('message', (raw) => {
      const message = JSON.parse(raw);
      switch (message.type) {
        case 'input_audio_buffer.speech_stopped':
          this.onSpeechStopped(message);
          break;
        case 'response.audio.delta':
          this.onAudioDelta(message);
          break;
      }
    });
  }

  onSpeechStopped(message: any) {}
  onAudioDelta(message: any) {}
}

export default AudioInterceptor;
