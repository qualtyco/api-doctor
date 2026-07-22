import WebSocket from 'ws';

// Adversarial: a third-party WebSocket that happens to use a header named
// 'OpenAI-Beta' with a 'realtime=v1'-looking value, but is not actually an
// OpenAI Realtime connection. Should not be flagged.
function setupUnrelatedSocket(): WebSocket {
  const url = 'wss://internal.example.com/v1/proxy';
  return new WebSocket(url, {
    headers: {
      'OpenAI-Beta': 'realtime=v1',
    },
  });
}
