// Env-var allowlist variant: trusts the from header alone.
import { AgentMailClient } from 'agentmail';
import { runCommand } from './commands.js';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function processCommandEmail(inboxId: string, messageId: string): Promise<void> {
  const msg = await agentmail.inboxes.messages.get(inboxId, messageId);
  if (msg.from !== process.env.AUTHORIZED_SENDER) {
    return;
  }
  await runCommand(msg.subject ?? '');
}
