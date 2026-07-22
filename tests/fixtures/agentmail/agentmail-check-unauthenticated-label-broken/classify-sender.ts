// Dinner-reservation shape: "the agent only accepts requests from this
// address" — but mail with MISSING auth headers is delivered too, and a
// forged from passes this check.
import { AgentMailClient } from 'agentmail';
import { handleOwnerRequest } from './reservations.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });
const USER_EMAIL = (process.env.USER_EMAIL ?? '').toLowerCase();

function senderEmail(message: any): string {
  return String(message.from ?? '').toLowerCase();
}

export async function classifyAndHandle(inboxId: string, messageId: string): Promise<void> {
  const message = await client.inboxes.messages.get(inboxId, messageId);
  if (senderEmail(message) === USER_EMAIL) {
    await handleOwnerRequest(message);
  }
}
