// State-file "get or create": any fresh checkout, container restart, or CI
// run silently creates a new inbox — the agent's address changes and the
// Free plan's 3-inbox cap fills up.
import { AgentMailClient } from 'agentmail';
import { readState, writeState } from './state.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function getOrCreateInbox() {
  const state = readState();
  if (state.inboxId) return state.inboxId;
  const inbox = await client.inboxes.create({
    username: 'approvals',
    displayName: 'Approval Agent',
  });
  writeState({ inboxId: inbox.inboxId });
  return inbox.inboxId;
}
