export async function parseResumeWithAnthropic(text: string, apiKey: string) {
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: JSON.stringify({ model: 'claude-3-5-sonnet-latest', messages: [{ role: 'user', content: text }] }),
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}
