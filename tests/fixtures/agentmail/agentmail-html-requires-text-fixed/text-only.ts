// Adversarial: text-only sending is the quickstart's own shape and is
// documented-correct — only html-without-text is the violation. Must not
// be flagged.
import { AgentMailClient } from 'agentmail';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function sendPlainUpdate(inboxId: string, to: string, update: string): Promise<void> {
  await agentmail.inboxes.messages.send(inboxId, {
    to: [to],
    subject: 'Status update',
    text: update,
  });
}
