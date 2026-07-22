// Approval inbox: pending lookup is by thread ID only, so the original
// requester's own reply of "approved" executes the pending action.
import { AgentMailClient } from 'agentmail';
import { executePendingAction, rejectPendingAction } from './requestsStore.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function handleReviewReply(inboxId: string, messageId: string): Promise<void> {
  const message = await client.inboxes.messages.get(inboxId, messageId);
  const replyText = (message.text ?? '').trim().toLowerCase();
  const decision = replyText.split('\n')[0];
  if (decision === 'approved') {
    await executePendingAction(message.threadId);
  } else if (decision === 'declined') {
    await rejectPendingAction(message.threadId);
  }
}
