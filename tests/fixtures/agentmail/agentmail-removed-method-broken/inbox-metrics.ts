import { AgentMailClient } from 'agentmail';

const mail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function inboxMetrics(inboxId: string) {
  // Same removal on the per-inbox sub-resource.
  const events = await mail.inboxes.metrics.query({ inboxId, period: 'hour' });
  return events;
}
