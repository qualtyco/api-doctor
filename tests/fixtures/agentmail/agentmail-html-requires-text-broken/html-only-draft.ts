// Same defect on the drafts surface.
import { AgentMailClient } from 'agentmail';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function draftReceipt(inboxId: string, customer: string, orderId: string) {
  return agentmail.inboxes.drafts.create(inboxId, {
    to: [customer],
    subject: `Receipt for order ${orderId}`,
    html: `<p>Your order <strong>${orderId}</strong> has been confirmed.</p>`,
    clientId: `receipt-${orderId}`,
  });
}
