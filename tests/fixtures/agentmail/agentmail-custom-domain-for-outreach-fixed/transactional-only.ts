// Adversarial: a shared-domain inbox sending a single transactional email
// (no campaign loop) — exactly what @agentmail.to is fine for. Must not be
// flagged.
import { AgentMailClient } from 'agentmail';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function notifyOwner(subject: string, text: string): Promise<void> {
  const inbox = await agentmail.inboxes.create({
    username: 'notifier',
    clientId: 'notifier-inbox-v1',
  });
  await agentmail.inboxes.messages.send(inbox.inboxId, {
    to: [process.env.OWNER_EMAIL ?? ''],
    subject,
    text,
  });
}
