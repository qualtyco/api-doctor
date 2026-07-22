import WebSocket from 'ws';

// Adversarial: a different WebSocket (not the OpenAI Realtime connection)
// logs its raw message verbatim. Out of scope for this rule.
function setup(logger: any) {
  const internalSocket = new WebSocket('wss://internal.example.com/events');

  internalSocket.on('message', (msg) => {
    logger.info(`Internal event: ${msg}`);
  });
}
