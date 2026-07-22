// Adversarial: no per-ticket ack() anywhere — looks like fire-and-forget —
// but close() in the finally flushes and settles outstanding batches before
// resolving, which is a legitimate "durable by the end" pattern.
import { AppendInput, AppendRecord, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function exportEvents(events: string[]) {
  const stream = s2.basin('analytics').stream('exports');
  const session = await stream.appendSession();

  try {
    for (const body of events) {
      await session.submit(AppendInput.create([AppendRecord.string({ body })]));
    }
  } finally {
    await session.close();
    await stream.close();
  }
}
