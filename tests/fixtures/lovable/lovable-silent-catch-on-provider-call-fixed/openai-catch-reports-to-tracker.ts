import * as Sentry from '@sentry/react';

// Looks like a bare catch at a glance (no console.error call), but it
// reports to the error tracker, which is exactly the visibility this rule
// requires — just via a different mechanism than console.error.
export async function parseResumeWithOpenAI(text: string, apiKey: string) {
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: text }] }),
    });
    return await resp.json();
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}
