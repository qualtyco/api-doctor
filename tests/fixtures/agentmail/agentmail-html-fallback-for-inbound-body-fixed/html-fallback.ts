// Correct: falls back to converting the html part when the text/plain
// part is absent (the browser-signup example's waitForEmail pattern).
import { AgentMailClient } from 'agentmail';
import { htmlToText } from 'html-to-text';
import { extractInvoice } from './llm.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function processInvoiceEmail(inboxId: string, messageId: string): Promise<void> {
  const full = await client.inboxes.messages.get(inboxId, messageId);
  const body = (full.extractedText ?? full.text)?.trim() || (full.html ? htmlToText(full.html) : '');
  if (!body) return;
  await extractInvoice(body);
}
