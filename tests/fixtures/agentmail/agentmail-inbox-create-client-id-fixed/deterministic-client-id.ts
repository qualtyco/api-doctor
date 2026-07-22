// Correct: deterministic clientId makes create idempotent — retries and
// redeploys return the same inbox.
import { AgentMailClient } from 'agentmail';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function getOrCreateInbox() {
  const inbox = await client.inboxes.create({
    username: 'approvals',
    displayName: 'Approval Agent',
    clientId: 'approval-inbox-v1',
  });
  return inbox.inboxId;
}
