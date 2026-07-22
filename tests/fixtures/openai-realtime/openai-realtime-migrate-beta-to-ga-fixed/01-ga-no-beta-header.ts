import WebSocket from 'ws';

function setupCallerSocket(apiKey: string): WebSocket {
  const url = 'wss://api.openai.com/v1/realtime';
  const callerSocket = new WebSocket(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  return callerSocket;
}
