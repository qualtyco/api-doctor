// docs-example-source: https://docs.agentmail.to/knowledge-base/rate-limits
// Explicit 429 wrapper honoring Retry-After. Relying on the SDK's built-in
// retries instead is equally documented-correct — neither shape may be flagged.
import { AgentMailClient } from "agentmail";

const client = new AgentMailClient({ apiKey: "am_..." });

async function sendWithRetry(inboxId: string, params: any, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await client.inboxes.messages.send(inboxId, params);
    } catch (error: any) {
      if (error.statusCode === 429 && attempt < maxRetries - 1) {
        const retryAfter = parseInt(error.headers?.["retry-after"] || "5");
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
      } else {
        throw error;
      }
    }
  }
}
