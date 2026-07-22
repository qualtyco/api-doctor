// Adversarial: tailOffset without clamp looks like the bug, but offset 0 is
// the tail itself — it can never point before the stream start, so clamp
// is unnecessary for a live follower starting at the end.
import { S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function follow(onRecord: (body: string) => void, signal: AbortSignal) {
  const stream = s2.basin('telemetry').stream('live');

  const session = await stream.readSession(
    {
      start: { from: { tailOffset: 0 } },
    },
    { signal },
  );

  for await (const record of session) {
    onRecord(String(record.body));
  }
}
