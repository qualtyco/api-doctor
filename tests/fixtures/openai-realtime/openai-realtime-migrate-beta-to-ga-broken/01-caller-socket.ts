import WebSocket from 'ws';

function setupCallerSocket(apiKey: string): WebSocket {
  const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
  const callerSocket = new WebSocket(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });
  return callerSocket;
}
