// Treats submit() as "written": no ticket ack() is ever awaited and the
// session is never closed, so the process can exit with batches in flight.
// (Closing the stream client does not flush the append session.)
import { AppendInput, AppendRecord, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function exportEvents(events: string[]) {
  const stream = s2.basin('analytics').stream('exports');
  const session = await stream.appendSession();

  for (const body of events) {
    await session.submit(AppendInput.create([AppendRecord.string({ body })]));
  }

  await stream.close();
}
