// HTML body with no text part: text-only clients render nothing and spam
// filters read the missing text/plain part as a bulk-mail signal.
import { AgentMailClient } from 'agentmail';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function sendWelcome(inboxId: string, to: string): Promise<void> {
  await client.inboxes.messages.send(inboxId, {
    to: [to],
    subject: 'Welcome!',
    html: '<h1>Welcome aboard</h1><p>Glad to have you with us.</p>',
  });
}
