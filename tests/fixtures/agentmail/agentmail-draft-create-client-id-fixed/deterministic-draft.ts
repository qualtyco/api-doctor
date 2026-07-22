// Correct: deterministic clientId derived from the triggering message —
// retried creates return the existing draft (note: no "@" allowed).
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
    clientId: `draft-${message.messageId.replace(/@/g, '_at_')}`,
  });
}
