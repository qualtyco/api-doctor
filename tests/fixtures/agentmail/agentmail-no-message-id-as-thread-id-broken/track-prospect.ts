// gtm shape: if threadId were absent this silently records a message ID
// as the prospect's thread — reply routing by thread never matches it.
import { AgentMailClient } from 'agentmail';
import { prospects } from './prospects.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function sendFirstTouch(inboxId: string, email: string, body: string): Promise<void> {
  const sent = await client.inboxes.messages.send(inboxId, {
    to: [email],
    subject: 'Quick question',
    text: body,
  });
  const threadId = sent.threadId ?? sent.messageId; // BUG: different ID types
  prospects.updateProspect(email, { status: 'first_touch_sent', threadId });
}
