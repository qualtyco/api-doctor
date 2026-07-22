// Documented pattern: await the ticket ack() for durability and close the
// session in a finally block to flush.
import { AppendInput, AppendRecord, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function exportEvents(events: string[]) {
  const stream = s2.basin('analytics').stream('exports');
  const session = await stream.appendSession();

  try {
    for (const body of events) {
      const ticket = await session.submit(
        AppendInput.create([AppendRecord.string({ body })]),
      );
      await ticket.ack();
    }
  } finally {
    await session.close();
    await stream.close();
  }
}
