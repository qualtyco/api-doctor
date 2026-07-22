export async function fetchRecording(sessionId: string, apiKey: string) {
  const url = `https://api.browserbase.com/v1/sessions/${sessionId}/recording`;
  const resp = await fetch(url, { headers: { 'X-BB-API-Key': apiKey } });
  return resp.json();
}
