import axios from 'axios';

export async function getSessionStatus(sessionId: string, apiKey: string) {
  const resp = await axios.get(`https://api.browserbase.com/v1/sessions/${sessionId}`, {
    headers: { 'X-BB-API-Key': apiKey },
  });
  return resp.data;
}
