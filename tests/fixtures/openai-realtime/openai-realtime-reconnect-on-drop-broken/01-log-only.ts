import WebSocket from 'ws';

function setup(logger: any) {
  const url = 'wss://api.openai.com/v1/realtime?model=gpt-realtime';
  const callerSocket = new WebSocket(url, { headers: {} });

  callerSocket.on('close', () => {
    logger.info('Caller webSocket connection to OpenAI is closed now.');
  });
}
