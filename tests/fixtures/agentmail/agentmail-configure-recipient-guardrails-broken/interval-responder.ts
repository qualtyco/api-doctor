// setInterval variant of the same unguarded auto-responder.
import { AgentMailClient } from 'agentmail';
import { acknowledgeInvoice } from './invoices.js';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export function startInvoiceAgent(inboxId: string): void {
  setInterval(async () => {
    const { messages } = await agentmail.inboxes.messages.list(inboxId, { labels: ['unread'] });
    for (const msg of messages) {
      const receipt = await acknowledgeInvoice(msg);
      await agentmail.inboxes.messages.reply(inboxId, msg.messageId, { text: receipt });
    }
  }, 30_000);
}
