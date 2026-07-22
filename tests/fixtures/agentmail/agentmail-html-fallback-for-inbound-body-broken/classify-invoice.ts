// Invoice-processor shape: an HTML-only forwarded invoice (Gmail/Outlook
// forwards commonly omit the text part) reads as an empty body here and
// gets discarded.
import { AgentMailClient } from 'agentmail';
import { extractInvoice } from './llm.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function processInvoiceEmail(inboxId: string, messageId: string): Promise<void> {
  const full = await client.inboxes.messages.get(inboxId, messageId);
  const body = full.extractedText ?? full.text ?? '';
  if (!body.trim()) {
    return; // BUG: HTML-only forwards land here and are silently dropped
  }
  await extractInvoice(body);
}
