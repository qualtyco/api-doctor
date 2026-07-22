// Correct: hard platform guardrails via Lists before the auto-reply loop —
// only our domain can trigger the agent.
import { AgentMailClient } from 'agentmail';
import { answerQuestion } from './llm.js';
import { sleep } from './util.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function runSupportAgent(inboxId: string): Promise<void> {
  await client.inboxes.lists.create(inboxId, 'receive', 'allow', { entry: 'ourcompany.com' });

  while (true) {
    const { messages } = await client.inboxes.messages.list(inboxId, { labels: ['unread'] });
    for (const msg of messages) {
      const answer = await answerQuestion(msg);
      await client.inboxes.messages.reply(inboxId, msg.messageId, { text: answer });
    }
    await sleep(15_000);
  }
}
