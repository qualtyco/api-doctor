import WebSocket from 'ws';

function setup(logger: any) {
  const url = 'wss://api.openai.com/v1/realtime?model=gpt-realtime';
  const callerSocket = new WebSocket(url, { headers: {} });

  callerSocket.on('message', (raw) => {
    const message = JSON.parse(raw);
    if (message.type === 'error') {
      logger.error({ error: message }, 'OpenAI Realtime API error event');
      return;
    }
    if (message.type === 'response.audio.delta') {
      logger.info('received translation');
    }
  });
}
