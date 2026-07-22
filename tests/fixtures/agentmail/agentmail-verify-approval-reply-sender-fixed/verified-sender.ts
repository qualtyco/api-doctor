// Correct: the sender is verified as the authorized approver (and the
// unauthenticated label rejected) before the decision is parsed.
import { AgentMailClient } from 'agentmail';
import { adapter } from './payments.js';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });
const APPROVER_EMAIL = (process.env.USER_EMAIL ?? '').toLowerCase();

export async function handleReviewReply(inboxId: string, messageId: string): Promise<void> {
  const full = await agentmail.inboxes.messages.get(inboxId, messageId);
  const sender = (full.from ?? '').toLowerCase();
  const labels: string[] = full.labels ?? [];
  if (sender !== APPROVER_EMAIL || labels.includes('unauthenticated')) {
    await agentmail.inboxes.messages.update(inboxId, messageId, {
      removeLabels: ['unread'],
      addLabels: ['unauthorized-decision'],
    });
    return; // never parse approve/decline from unverified senders
  }
  const body = (full.text ?? '').toLowerCase();
  if (body.includes('approve')) {
    await adapter.pay(full.threadId);
  }
}
