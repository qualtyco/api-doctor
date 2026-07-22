// Looks like the broken shape (same host, same header name), but the key
// comes from a short-lived token minted by our own Edge Function, not from
// import.meta.env.VITE_* — there is no VITE_-exposed secret here.
export async function parseResumeWithAnthropicProxy(text: string, proxyToken: string) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': proxyToken,
    },
    body: JSON.stringify({ model: 'claude-3-5-sonnet-latest', messages: [{ role: 'user', content: text }] }),
  });
  if (!resp.ok) return null;
  return resp.json();
}
