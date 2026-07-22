// Export endpoint that "downloads the stream" with one capped read.
import { S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function GET() {
  const stream = s2.basin('analytics').stream('audit-log');

  const batch = await stream.read({
    start: { from: { seqNum: 0 } },
    stop: { limits: { count: 100000 } },
  });

  return Response.json({ total: batch.records.length, entries: batch.records });
}
