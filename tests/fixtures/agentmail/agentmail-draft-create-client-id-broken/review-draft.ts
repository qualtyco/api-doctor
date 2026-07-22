// Inbox-zero shape: the draft workflow is right, but without clientId a
// crash between create and markRead duplicates the draft on the next poll.
import { AgentMailClient } from 'agentmail';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function draftReply(
  inboxId: string,
  message: { messageId: string; from?: string },
  subject: string,
  text: string,
): Promise<void> {
  await agentmail.inboxes.drafts.create(inboxId, {
    inReplyTo: message.messageId,
    to: message.from ? [message.from] : undefined,
    subject,
    text,
  });
  await agentmail.inboxes.messages.update(inboxId, message.messageId, {
    removeLabels: ['unread'],
    addLabels: ['drafted'],
  });
}
