// Correct: outreach runs from a verified custom subdomain (no MX conflict
// with the root domain).
import { AgentMailClient } from 'agentmail';
import { queuedProspects } from './prospects.js';
import { sleep } from './util.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function runOutreach(): Promise<void> {
  const inbox = await client.inboxes.create({
    username: 'outreach',
    domain: 'agents.ourcompany.com',
    clientId: 'gtm-outreach-v1',
  });
  for (const prospect of queuedProspects()) {
    await client.inboxes.messages.send(inbox.inboxId, {
      to: [prospect.email],
      subject: 'Quick question',
      text: prospect.pitch,
    });
    await sleep(2_000);
  }
}
