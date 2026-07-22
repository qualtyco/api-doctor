// "Show the 50 most recent entries" — errors on any stream with fewer
// than 50 records instead of clamping to the start.
import { S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function recentEntries(tenant: string) {
  const stream = s2.basin('audit').stream(`tenants/${tenant}/log`);

  const session = await stream.readSession({
    start: { from: { tailOffset: 50 } },
    stop: { waitSecs: 0 },
  });

  const entries: string[] = [];
  for await (const record of session) {
    entries.push(String(record.body));
  }
  return entries;
}
