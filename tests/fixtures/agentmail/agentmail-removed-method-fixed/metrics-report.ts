import { AgentMailClient } from 'agentmail';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function dailyReport() {
  const events = await client.metrics.queryEvents({ period: 'day', limit: 30 });
  const usage = await client.metrics.queryUsage({ period: 'day' });
  return { events, usage };
}
