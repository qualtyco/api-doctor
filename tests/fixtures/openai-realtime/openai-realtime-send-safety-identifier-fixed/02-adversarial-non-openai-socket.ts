import WebSocket from 'ws';

// Adversarial: a non-OpenAI-Realtime WebSocket that also omits a safety
// identifier header. Out of scope for this rule.
function setup(): WebSocket {
  const url = 'wss://internal.example.com/events';
  return new WebSocket(url, { headers: {} });
}
