// Correct: from-equality only counts when the message does not carry the
// "unauthenticated" label (missing SPF/DKIM/DMARC headers).
import { AgentMailClient } from 'agentmail';
import { handleOwnerRequest } from './reservations.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });
const USER_EMAIL = (process.env.USER_EMAIL ?? '').toLowerCase();

function senderEmail(message: any): string {
  return String(message.from ?? '').toLowerCase();
}

export async function classifyAndHandle(inboxId: string, messageId: string): Promise<void> {
  const message = await client.inboxes.messages.get(inboxId, messageId);
  const isTrusted =
    senderEmail(message) === USER_EMAIL &&
    !(message.labels ?? []).includes('unauthenticated');
  if (isTrusted) {
    await handleOwnerRequest(message);
  }
}
