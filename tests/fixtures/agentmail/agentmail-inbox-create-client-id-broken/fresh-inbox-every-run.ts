// Browser-signup shape: a brand-new inbox on every run, no state at all —
// hits the Free plan's 3-inbox cap on the fourth execution.
import { AgentMailClient } from 'agentmail';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function provisionSignupInbox(): Promise<string> {
  const inbox = await agentmail.inboxes.create();
  console.log(`signup inbox ready: ${inbox.inboxId}`);
  return inbox.inboxId;
}
