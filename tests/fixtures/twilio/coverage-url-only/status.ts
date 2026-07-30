export async function messageStatus(messageSid: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID ?? '';
  const token = process.env.TWILIO_AUTH_TOKEN ?? '';
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages/${messageSid}.json`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      },
    },
  );
  if (!res.ok) {
    throw new Error(`Twilio request failed with status ${res.status}`);
  }
  return res.json();
}
