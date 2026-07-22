// Correct: both html and text versions of the same content.
import { AgentMailClient } from 'agentmail';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function sendWelcome(inboxId: string, to: string): Promise<void> {
  await client.inboxes.messages.send(inboxId, {
    to: [to],
    subject: 'Welcome!',
    text: 'Welcome aboard\n\nGlad to have you with us.',
    html: '<h1>Welcome aboard</h1><p>Glad to have you with us.</p>',
  });
}
