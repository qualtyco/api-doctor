// setInterval variant of the same polling architecture.
import { AgentMailClient } from 'agentmail';
import { routeThread } from './router.js';

const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export function startRouter(inboxId: string): void {
  setInterval(async () => {
    const threads = await agentmail.inboxes.threads.list(inboxId, { labels: ['unread'] });
    for (const thread of threads.threads) {
      await routeThread(thread);
    }
  }, 15_000);
}
