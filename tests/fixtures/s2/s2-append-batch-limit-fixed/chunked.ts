// Chunk the source array into compliant batches through one append session.
import { AppendInput, AppendRecord, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function backfill(events: string[]) {
  const stream = s2.basin('analytics').stream('pageviews');
  const session = await stream.appendSession();

  try {
    for (let i = 0; i < events.length; i += 1000) {
      const chunk = events.slice(i, i + 1000);
      const ticket = await session.submit(
        AppendInput.create(chunk.map((body) => AppendRecord.string({ body }))),
      );
      await ticket.ack();
    }
  } finally {
    await session.close();
    await stream.close();
  }
}
