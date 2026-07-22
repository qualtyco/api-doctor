// Adversarial: the catch logs context and rethrows — the failure
// propagates to a supervisor instead of being swallowed. Must not be
// flagged.
import { AgentMailClient } from 'agentmail';
import { classify } from './llm.js';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function processBatch(inboxId: string, ids: string[]): Promise<void> {
  for (const messageId of ids) {
    try {
      const full = await agentmail.inboxes.messages.get(inboxId, messageId);
      await classify(full);
    } catch (err) {
      console.error(`processing ${messageId} failed`, err);
      throw err; // supervisor decides: retry with backoff or alert
    }
  }
}
