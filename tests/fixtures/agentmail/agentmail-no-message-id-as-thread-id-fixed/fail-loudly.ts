// Correct: fail loudly when the response carries no threadId instead of
// substituting an identifier of a different type.
import { AgentMailClient } from 'agentmail';
import { prospects } from './prospects.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function sendFirstTouch(inboxId: string, email: string, body: string): Promise<void> {
  const sent = await client.inboxes.messages.send(inboxId, {
    to: [email],
    subject: 'Quick question',
    text: body,
  });
  if (!sent.threadId) {
    throw new Error(`send ${sent.messageId} returned no threadId`);
  }
  prospects.updateProspect(email, { status: 'first_touch_sent', threadId: sent.threadId });
}
