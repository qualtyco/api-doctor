// Timeseries set queried without an interval — the resolution of the
// returned series is whatever the service defaults to, not a choice.
import { S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function basinStorage(basin: string) {
  return s2.metrics.basin({
    basin,
    set: 'storage',
    start: new Date(Date.now() - 6 * 3600 * 1000),
    end: new Date(),
  });
}
