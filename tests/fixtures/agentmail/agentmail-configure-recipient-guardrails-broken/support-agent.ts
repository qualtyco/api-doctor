// Support-agent shape: a forever poll loop that replies to ANY inbound
// sender — including other bots — with no Lists guardrails anywhere.
import { AgentMailClient } from 'agentmail';
import { answerQuestion } from './llm.js';
import { sleep } from './util.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function runSupportAgent(inboxId: string): Promise<void> {
  while (true) {
    const { messages } = await client.inboxes.messages.list(inboxId, { labels: ['unread'] });
    for (const msg of messages) {
      const answer = await answerQuestion(msg);
      await client.inboxes.messages.reply(inboxId, msg.messageId, { text: answer });
      await client.inboxes.messages.update(inboxId, msg.messageId, {
        removeLabels: ['unread'],
        addLabels: ['answered'],
      });
    }
    await sleep(15_000);
  }
}
