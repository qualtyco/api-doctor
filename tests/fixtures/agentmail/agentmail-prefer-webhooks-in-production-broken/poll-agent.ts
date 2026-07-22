// The 14-of-14 skeleton: a forever loop polling messages.list on a fixed
// interval, with per-message get amplification.
import { AgentMailClient } from 'agentmail';
import { handle } from './handler.js';
import { sleep } from './util.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function main(inboxId: string): Promise<void> {
  while (true) {
    const { messages } = await client.inboxes.messages.list(inboxId, { labels: ['unread'] });
    for (const msg of messages) {
      const full = await client.inboxes.messages.get(inboxId, msg.messageId);
      await handle(full);
    }
    await sleep(30_000);
  }
}
