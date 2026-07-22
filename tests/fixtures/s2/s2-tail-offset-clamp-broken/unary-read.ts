// Unary-read variant of the missing clamp.
import { S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function lastHundred() {
  const stream = s2.basin('telemetry').stream('samples');

  const batch = await stream.read({
    start: { from: { tailOffset: 100 } },
    stop: { limits: { count: 100 } },
  });

  return batch.records;
}
