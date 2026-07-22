// Adversarial: the draft options are assembled in a helper and *do* carry
// a clientId — a variable argument must not be flagged.
import { AgentMailClient } from 'agentmail';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

function buildDraftOptions(orderId: string, customer: string) {
  return {
    to: [customer],
    subject: `Order ${orderId} confirmation`,
    text: 'Your order has been confirmed.',
    clientId: `order-${orderId}-confirmation`,
  };
}

export async function queueOrderConfirmation(inboxId: string, orderId: string, customer: string) {
  const options = buildDraftOptions(orderId, customer);
  return client.inboxes.drafts.create(inboxId, options);
}
