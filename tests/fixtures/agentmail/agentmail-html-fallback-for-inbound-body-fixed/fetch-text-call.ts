// Adversarial: `res.text()` is the fetch API, and `text:` in send options
// is an object key — neither is a message-field read. Must not be flagged.
import { AgentMailClient } from 'agentmail';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function forwardUnreadCount(inboxId: string, webhookUrl: string): Promise<void> {
  const { messages } = await agentmail.inboxes.messages.list(inboxId, { labels: ['unread'] });
  const res = await fetch(webhookUrl, {
    method: 'POST',
    body: JSON.stringify({ unread: messages.length }),
  });
  const ack = await res.text();
  await agentmail.inboxes.messages.send(inboxId, {
    to: [process.env.OPS_EMAIL ?? ''],
    subject: 'Unread count forwarded',
    text: `Webhook acknowledged with: ${ack}`,
  });
}
