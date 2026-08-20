import { AgentMailClient } from 'agentmail';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

// A project's own object that happens to expose the same method path. The
// receiver is not an AgentMail client, so it must never be reported — this is
// what the traced-receiver requirement buys.
const metrics = {
  query(_filter: { since: string }) {
    return [] as Array<{ name: string; value: number }>;
  },
};

export async function localAndRemote() {
  const mine = metrics.query({ since: '2026-01-01' });
  const theirs = await client.metrics.queryEvents({ period: 'day' });
  return { mine, theirs };
}
