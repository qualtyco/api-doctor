// Chained-catch variant: the rejection handler swallows every failure
// without distinguishing permanent 403s from transient errors.
import { AgentMailClient } from 'agentmail';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export function acknowledgeInvoice(inboxId: string, sender: string, invoiceId: string): void {
  void agentmail.inboxes.messages
    .send(inboxId, {
      to: [sender],
      subject: `Invoice ${invoiceId} received`,
      text: 'We got your invoice and will process it shortly.',
    })
    .catch((e) => console.error('ack failed', e));
}
