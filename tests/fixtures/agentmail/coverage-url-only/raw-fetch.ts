export async function sendRaw(inboxId: string, to: string) {
  await fetch(`https://api.agentmail.to/v0/inboxes/${inboxId}/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: [to], subject: 'hi', text: 'hi there' }),
  });
}
