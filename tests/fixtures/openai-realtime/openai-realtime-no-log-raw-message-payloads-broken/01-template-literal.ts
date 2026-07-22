import WebSocket from 'ws';

function setup(logger: any) {
  const url = 'wss://api.openai.com/v1/realtime?model=gpt-realtime';
  const callerSocket = new WebSocket(url, { headers: {} });

  callerSocket.on('message', (msg) => {
    logger.info(`Caller message from OpenAI: ${msg}`);
  });
}
