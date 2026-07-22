// Adversarial: the only sender comparison is the skip-our-own-messages
// loop guard — that is not authorization and must not be flagged.
import { AgentMailClient } from 'agentmail';
import { summarize } from './llm.js';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function summarizeUnread(inboxId: string, ourInboxAddress: string): Promise<void> {
  const { messages } = await agentmail.inboxes.messages.list(inboxId, { labels: ['unread'] });
  for (const msg of messages) {
    if (msg.from === ourInboxAddress) {
      continue; // don't summarize our own outbound copies
    }
    await summarize(msg);
  }
}
