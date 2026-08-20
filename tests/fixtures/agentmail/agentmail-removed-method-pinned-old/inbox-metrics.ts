import { AgentMailClient } from 'agentmail';

const mail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function inboxMetrics(inboxId: string) {
  const events = await mail.inboxes.metrics.query({ inboxId, period: 'hour' });
  return events;
}
