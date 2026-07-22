// Adversarial: compares an "approved" status from our own database column —
// not a decision parsed out of an email body. Must not be flagged.
import { AgentMailClient } from 'agentmail';
import { requests } from './requestsStore.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function notifyIfApproved(inboxId: string, threadId: string): Promise<void> {
  const request = await requests.findByThread(threadId);
  if (request.status === 'approved') {
    await client.inboxes.messages.send(inboxId, {
      to: [request.requesterAddress],
      subject: `Request ${request.id} approved`,
      text: 'Your request was approved by the reviewer.',
    });
  }
}
