// Adversarial: a send inside a loop that is a *retry* loop with backoff
// (the rate-limits guide's own wrapper) — not an unthrottled burst.
import { AgentMailClient } from 'agentmail';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function sendWithRetry(inboxId: string, params: any, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await client.inboxes.messages.send(inboxId, params);
    } catch (error: any) {
      if (error.statusCode === 429 && attempt < maxRetries - 1) {
        const retryAfter = parseInt(error.headers?.['retry-after'] || '5');
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
      } else {
        throw error;
      }
    }
  }
}
