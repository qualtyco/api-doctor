// Correct: a per-send delay spaces the campaign out.
import { AgentMailClient } from 'agentmail';
import { queuedProspects } from './prospects.js';
import { sleep } from './util.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function runCampaign(inboxId: string): Promise<void> {
  for (const prospect of queuedProspects()) {
    await client.inboxes.messages.send(inboxId, {
      to: [prospect.email],
      subject: 'Quick question',
      text: prospect.pitch,
    });
    await sleep(2_000); // spread the volume — don't burst from one address
  }
}
