// Dynamic property access is the same call — still missing clientId.
import { AgentMailClient } from 'agentmail';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function queueOrderConfirmation(inboxId: string, customer: string): Promise<void> {
  await client.inboxes.drafts['create'](inboxId, {
    to: [customer],
    subject: 'Order confirmation',
    text: 'Your order has been confirmed.',
  });
}
