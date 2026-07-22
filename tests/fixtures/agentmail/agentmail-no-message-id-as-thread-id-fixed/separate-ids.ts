// Adversarial: coalescing threadId with another *thread* identifier, and
// storing messageId in its own slot — both correct, must not be flagged.
import { AgentMailClient } from 'agentmail';
import { saveOutbound } from './store.js';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function replyOnThread(
  inboxId: string,
  existingThreadId: string,
  to: string,
): Promise<void> {
  const sent = await agentmail.inboxes.messages.send(inboxId, {
    to: [to],
    subject: 'Following up',
    text: 'Circling back on the thread.',
  });
  await saveOutbound({
    messageId: sent.messageId,
    threadId: sent.threadId ?? existingThreadId, // falls back to a real thread ID
  });
}
