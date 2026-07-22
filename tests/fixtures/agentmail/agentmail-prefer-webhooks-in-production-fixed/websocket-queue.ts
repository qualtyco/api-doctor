// Adversarial: a forever loop that drains an in-process queue fed by a
// WebSocket — it never polls messages.list. Must not be flagged.
import { AgentMailClient } from 'agentmail';
import { inboundQueue } from './socket.js';
import { handle } from './handler.js';
import { sleep } from './util.js';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function drainQueue(inboxId: string): Promise<void> {
  while (true) {
    const event = inboundQueue.shift();
    if (!event) {
      await sleep(100);
      continue;
    }
    const full = await agentmail.inboxes.messages.get(inboxId, event.messageId);
    await handle(full);
  }
}
