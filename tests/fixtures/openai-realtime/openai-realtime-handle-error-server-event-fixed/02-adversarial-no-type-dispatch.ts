import WebSocket from 'ws';

// Adversarial: this handler doesn't branch on message.type at all (e.g. it
// forwards everything to a single downstream consumer), so there's no
// type-dispatch pattern to be missing an 'error' branch from.
function setup(forwardToClient: (raw: unknown) => void) {
  const url = 'wss://api.openai.com/v1/realtime?model=gpt-realtime';
  const callerSocket = new WebSocket(url, { headers: {} });

  callerSocket.on('message', (raw) => {
    forwardToClient(raw);
  });
}
