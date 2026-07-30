export async function getMessage(inboxId: string, messageId: string) {
  const res = await fetch(`https://api.agentmail.to/v0/inboxes/${inboxId}/messages/${messageId}`, {
    headers: { Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}` },
  });
  return res.json();
}
