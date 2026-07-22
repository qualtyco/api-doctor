// Adversarial: no try/catch at all looks unsafe, but the SDK already
// retries 408/429/5xx per Retry-After — a propagated error here is the
// correct outcome, not a swallowed one. Must not be flagged.
import { AgentMailClient } from 'agentmail';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function sendDigest(inboxId: string, to: string, digest: string): Promise<string> {
  const sent = await agentmail.inboxes.messages.send(inboxId, {
    to: [to],
    subject: 'Your morning digest',
    text: digest,
  });
  return sent.messageId;
}
