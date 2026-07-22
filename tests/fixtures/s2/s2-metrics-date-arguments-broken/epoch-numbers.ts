// The Python-SDK epoch pattern ported into TypeScript — start/end must be
// Date objects here, not numbers.
import { S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function activeBasinsLastMonth() {
  return s2.metrics.account({
    set: 'active-basins',
    start: Date.now() - 30 * 24 * 3600 * 1000,
    end: Date.now(),
  });
}
