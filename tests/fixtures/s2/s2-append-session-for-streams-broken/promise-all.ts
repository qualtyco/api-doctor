// Fan-out: one unary append per event under Promise.all — no cross-batch
// ordering guarantee, and bursts trip the 200 batches/sec client limit.
import { AppendInput, AppendRecord, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function publishBatch(events: string[]) {
  const stream = s2.basin('analytics').stream('clicks');

  await Promise.all(
    events.map((body) =>
      stream.append(AppendInput.create([AppendRecord.string({ body })])),
    ),
  );
}
