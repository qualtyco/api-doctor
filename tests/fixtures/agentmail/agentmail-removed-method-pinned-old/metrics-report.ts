// Identical code to the broken fixture, on a project pinned to 0.5.11 —
// the last version where metrics.query exists. Correct, and silent forever.
import { AgentMailClient } from 'agentmail';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function dailyReport() {
  const metrics = await client.metrics.query({ period: 'day', limit: 30 });
  return metrics;
}
