// Correct: 403 (suppressed address) transitions the prospect out of the
// queue; anything else is rethrown for the transient-retry path.
import { AgentMailClient } from 'agentmail';
import { prospects } from './prospects.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function sendFirstTouch(inboxId: string, email: string, body: string): Promise<void> {
  try {
    await client.inboxes.messages.send(inboxId, {
      to: [email],
      subject: 'Quick question',
      text: body,
    });
    prospects.updateProspect(email, { status: 'first_touch_sent' });
  } catch (e: any) {
    if (e.statusCode === 403) {
      prospects.updateProspect(email, { status: 'suppressed' }); // stop retrying
      return;
    }
    throw e; // transient — let the caller's retry policy decide
  }
}
