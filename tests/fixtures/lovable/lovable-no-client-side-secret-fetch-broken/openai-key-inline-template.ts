export async function parseResumeWithOpenAI(text: string) {
  // Key referenced directly inside an Authorization template literal,
  // no intermediate variable — a distinct manifestation of the same leak.
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: text }] }),
  });
  if (!resp.ok) return null;
  return resp.json();
}
