const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

export async function parseResumeWithAnthropic(text: string) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
    },
    body: JSON.stringify({ model: 'claude-3-5-sonnet-latest', messages: [{ role: 'user', content: text }] }),
  });
  if (!resp.ok) return null;
  return resp.json();
}
