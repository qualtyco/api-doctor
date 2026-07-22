import WebSocket from 'ws';

function setup(apiKey: string) {
  const url = `wss://api.openai.com/v1/realtime?model=gpt-realtime`;
  return new WebSocket(url, { headers: { Authorization: `Bearer ${apiKey}` } });
}
