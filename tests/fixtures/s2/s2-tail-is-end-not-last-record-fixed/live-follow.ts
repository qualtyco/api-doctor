// Adversarial: tailOffset: 0 with no stop condition looks like the
// "read from the tail" bug, but this is the documented live follower —
// start after all current records and stream future ones until aborted.
import { S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function followStream(onRecord: (body: string) => void, signal: AbortSignal) {
  const stream = s2.basin('telemetry').stream('live', { forceTransport: 's2s' });

  const session = await stream.readSession(
    {
      start: { from: { tailOffset: 0 }, clamp: true },
    },
    { signal },
  );

  for await (const record of session) {
    onRecord(String(record.body));
  }
}
