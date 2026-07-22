// Adversarial: the options object is built elsewhere and *does* carry a
// clientId — passing it as a variable must not be flagged.
import { AgentMailClient } from 'agentmail';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

const inboxOptions = {
  username: 'support',
  clientId: `support-inbox-${process.env.DEPLOY_ENV ?? 'prod'}`,
};

export async function provisionInbox() {
  const inbox = await agentmail.inboxes.create(inboxOptions);
  return inbox.inboxId;
}
