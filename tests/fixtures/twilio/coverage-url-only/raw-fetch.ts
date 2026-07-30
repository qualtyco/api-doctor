export async function sendSmsRaw(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID ?? '';
  const token = process.env.TWILIO_AUTH_TOKEN ?? '';
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: '+15017122661', Body: body }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Twilio request failed with status ${res.status}`);
  }
  return res.json();
}
