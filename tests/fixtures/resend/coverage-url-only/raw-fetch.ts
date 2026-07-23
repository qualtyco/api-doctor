export async function sendRaw(to: string) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: 'a@b.co', to, subject: 'hi', html: '<p>hi</p>' }),
  });
}
