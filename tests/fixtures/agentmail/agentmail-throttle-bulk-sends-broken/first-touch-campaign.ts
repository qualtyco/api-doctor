// gtm shape: the whole prospect CSV bursts from one inbox as fast as the
// API accepts — 429s, plan-volume burn, deliverability damage.
import { AgentMailClient } from 'agentmail';
import { queuedProspects } from './prospects.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function runCampaign(inboxId: string): Promise<void> {
  for (const prospect of queuedProspects()) {
    await client.inboxes.messages.send(inboxId, {
      to: [prospect.email],
      subject: 'Quick question',
      text: prospect.pitch,
    });
  }
}
