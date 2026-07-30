export async function createSessionRaw(projectId: string) {
  const res = await fetch('https://api.browserbase.com/v1/sessions', {
    method: 'POST',
    headers: {
      'x-bb-api-key': `${process.env.BROWSERBASE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ projectId }),
  });
  return res.json();
}
