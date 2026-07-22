// x402-style payment agent: any unread reply on a pending-review thread —
// including one from the vendor who requested the payment — fires the adapter.
import { AgentMailClient } from 'agentmail';
import { adapter } from './payments.js';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function pollPendingReviews(inboxId: string): Promise<void> {
  const { messages } = await agentmail.inboxes.messages.list(inboxId, {
    labels: ['pending-review', 'unread'],
  });
  for (const item of messages) {
    const full = await agentmail.inboxes.messages.get(inboxId, item.messageId);
    const body = (full.text ?? '').toLowerCase();
    // BUG: no check on who sent this reply before acting on it.
    if (body.includes('approve')) {
      await adapter.pay(full.threadId);
    } else if (body.includes('reject')) {
      await adapter.cancel(full.threadId);
    }
  }
}
