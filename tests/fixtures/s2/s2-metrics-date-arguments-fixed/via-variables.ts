// Adversarial: bare identifiers as start/end look like the epoch-number
// bug, but they are Date objects built above — a static rule must accept
// variables it cannot type.
import { S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function appendOpsReport(basin: string) {
  const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000);
  const now = new Date();

  return s2.metrics.basin({
    basin,
    set: 'append-ops',
    start: sixHoursAgo,
    end: now,
    interval: 'hour',
  });
}
