import WebSocket from 'ws';

// Adversarial: a different WebSocket's close handler only logs, with no
// reconnect attempt — but it's not the OpenAI Realtime connection, so this
// rule should not flag it.
function setup(logger: any) {
  const internalSocket = new WebSocket('wss://internal.example.com/events');

  internalSocket.on('close', () => {
    logger.info('internal socket closed');
  });
}
