// Backfill script that maps 5000 synthetic events into a single batch —
// S2 rejects any batch over 1000 records / 1 MiB.
import { AppendInput, AppendRecord, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function backfill() {
  const stream = s2.basin('analytics').stream('pageviews');

  const ack = await stream.append(
    AppendInput.create(
      Array.from({ length: 5000 }, (_, i) =>
        AppendRecord.string({ body: JSON.stringify({ page: `/p/${i}` }) }),
      ),
    ),
  );

  return ack.end.seqNum;
}
