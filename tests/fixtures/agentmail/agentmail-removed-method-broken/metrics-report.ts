// metrics.query was split into queryEvents (GET /v0/metrics/events) and
// queryUsage (GET /v0/metrics/usage) in 0.5.12.
import { AgentMailClient } from 'agentmail';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function dailyReport() {
  const metrics = await client.metrics.query({ period: 'day', limit: 30 });
  return metrics;
}
