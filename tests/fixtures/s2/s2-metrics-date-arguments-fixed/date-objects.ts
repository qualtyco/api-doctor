// The documented TypeScript shapes: Date objects and an explicit interval
// for timeseries sets.
import { S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function dashboards(basin: string, stream: string) {
  const accountMetrics = await s2.metrics.account({
    set: 'active-basins',
    start: new Date(Date.now() - 30 * 24 * 3600 * 1000),
    end: new Date(),
  });

  const streamStorage = await s2.metrics.stream({
    basin,
    stream,
    set: 'storage',
    start: new Date(Date.now() - 3600 * 1000),
    end: new Date(),
    interval: 'minute',
  });

  return { accountMetrics, streamStorage };
}
