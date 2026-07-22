// Correct: on failure the message is transitioned server-side out of the
// poll set, with a label a separate retry/alerting path can watch.
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
        console.error('processing failed, dead-lettering', err);
        await client.inboxes.messages.update(inboxId, msg.messageId, {
          removeLabels: ['unread'],
          addLabels: ['processing-failed'],
        });
      }
    }
    await sleep(15_000);
  }
}
