// Distinct manifestation: the catch parameter is bound and used to set a
// fallback value, but still never logged anywhere.
export async function parseResumeWithOpenAI(text: string, apiKey: string) {
  let parsed: unknown = undefined;
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: text }] }),
    });
    parsed = await resp.json();
  } catch (err) {
    parsed = null;
  }
  return parsed;
}
