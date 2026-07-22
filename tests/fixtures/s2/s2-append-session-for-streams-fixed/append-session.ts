// Documented steady-stream writer: one session pipelines the batches,
// preserves order, and applies backpressure.
import { AppendInput, AppendRecord, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function publishBatch(events: string[]) {
  const stream = s2.basin('analytics').stream('clicks');
  const session = await stream.appendSession();

  try {
    const tickets = [];
    for (const body of events) {
      tickets.push(
        await session.submit(AppendInput.create([AppendRecord.string({ body })])),
      );
    }
    await Promise.all(tickets.map((t) => t.ack()));
  } finally {
    await session.close();
    await stream.close();
  }
}
