// Approval-inbox shape: a message whose processing throws stays "unread",
// so every 15-second poll retries it — including its LLM classification
// call — indefinitely.
import { AgentMailClient } from 'agentmail';
import { classify } from './llm.js';
import { sleep } from './util.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function runAgent(inboxId: string): Promise<void> {
  while (true) {
    const { messages } = await client.inboxes.messages.list(inboxId, { labels: ['unread'] });
    for (const msg of messages) {
      try {
        const full = await client.inboxes.messages.get(inboxId, msg.messageId);
        await classify(full);
      } catch (err) {
        console.error('processing failed', err); // BUG: poison-message loop
      }
    }
    await sleep(15_000);
  }
}
