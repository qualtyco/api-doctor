export async function getSessionStatus(id: string) {
  const res = await fetch(`https://api.browserbase.com/v1/sessions/${id}`, {
    headers: { 'x-bb-api-key': `${process.env.BROWSERBASE_API_KEY}` },
  });
  return res.json();
}
