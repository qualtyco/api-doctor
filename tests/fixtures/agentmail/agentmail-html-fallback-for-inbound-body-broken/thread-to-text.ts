// Inbox-zero shape: mapping threads to their text parts drops HTML-only
// messages from the conversation entirely.
import { AgentMailClient } from 'agentmail';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function threadToMessages(inboxId: string, threadId: string): Promise<string[]> {
  const thread = await agentmail.inboxes.threads.get(inboxId, threadId);
  return (thread.messages ?? [])
    .map((m: any) => m.text)
    .filter((t: unknown): t is string => Boolean(t));
}
