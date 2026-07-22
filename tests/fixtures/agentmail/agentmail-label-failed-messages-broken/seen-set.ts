// Inbox-zero shape: an in-memory seen set hides the failure until the next
// restart, which then reprocesses everything (including handlers that had
// already partially run).
import { AgentMailClient } from 'agentmail';
import { triage } from './llm.js';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });
const seen = new Set<string>();

export async function pollOnce(inboxId: string): Promise<void> {
  const { messages } = await agentmail.inboxes.messages.list(inboxId, { labels: ['unread'] });
  for (const msg of messages) {
    if (seen.has(msg.messageId)) continue;
    seen.add(msg.messageId);
    try {
      const full = await agentmail.inboxes.messages.get(inboxId, msg.messageId);
      await triage(full);
    } catch (err) {
      console.error('triage failed', err); // BUG: dropped until restart, then re-run
    }
  }
}
