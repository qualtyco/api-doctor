export async function parseResume(text: string, accessToken: string, supabaseUrl: string) {
  const resp = await fetch(`${supabaseUrl}/functions/v1/parse-resume`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) return null;
  return resp.json();
}
