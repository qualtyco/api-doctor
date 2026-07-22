import WebSocket from 'ws';

function setup(apiKey: string) {
  const url = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01`;
  return new WebSocket(url, { headers: { Authorization: `Bearer ${apiKey}` } });
}
