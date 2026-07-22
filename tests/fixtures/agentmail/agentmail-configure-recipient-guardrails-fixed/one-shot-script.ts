// Adversarial: a one-shot reply script (the documented label-tracking
// loop) — not a long-running autonomous agent. Must not be flagged.
import { AgentMailClient } from 'agentmail';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function replyToUnreplied(inboxId: string): Promise<void> {
  const threads = await client.inboxes.threads.list(inboxId, { labels: ['unreplied'] });
  for (const thread of threads.threads) {
    const detail = await client.threads.get(thread.threadId);
    const lastMessage = detail.messages[detail.messages.length - 1];
    await client.inboxes.messages.reply(inboxId, lastMessage.messageId, {
      text: 'Thanks for reaching out!',
    });
    await client.inboxes.messages.update(inboxId, lastMessage.messageId, {
      addLabels: ['replied'],
      removeLabels: ['unreplied'],
    });
  }
}
