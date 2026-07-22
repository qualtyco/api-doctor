import WebSocket from 'ws';

function setup(apiKey: string, callerLanguage: string): WebSocket {
  const url = 'wss://api.openai.com/v1/realtime?model=gpt-realtime';
  return new WebSocket(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'OpenAI-Safety-Identifier': hashCallerLanguage(callerLanguage),
    },
  });
}

declare function hashCallerLanguage(value: string): string;
