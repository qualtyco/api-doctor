import WebSocket from 'ws';

// Adversarial: this is a *dated* model id, which might look suspicious, but
// it's a GA snapshot (no "-preview-" segment), not a beta preview snapshot.
function setup(apiKey: string) {
  const url = `wss://api.openai.com/v1/realtime?model=gpt-realtime-2025-08-28`;
  return new WebSocket(url, { headers: { Authorization: `Bearer ${apiKey}` } });
}
