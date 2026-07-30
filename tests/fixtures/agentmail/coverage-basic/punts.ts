import { agentmail } from './lib/agentmail';

// A bare reference is not a call — inboxes.messages.reply must not be recorded.
export const replyRef = agentmail.inboxes.messages.reply;

// Destructured resources are a documented punt — threads.list must not be recorded.
const { threads } = agentmail;

export async function listThreads() {
  return threads.list();
}

// Right shape, wrong root — inboxes.create on a plain object must not be recorded.
const db = { inboxes: { create: () => ({ inboxId: 'local' }) } };

export function seedLocalInbox() {
  return db.inboxes.create();
}
