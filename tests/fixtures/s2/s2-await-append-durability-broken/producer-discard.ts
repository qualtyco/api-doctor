// Producer variant: tickets are discarded and the producer never closed —
// nothing confirms the records became durable.
import { AppendRecord, BatchTransform, Producer, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function logMetrics(samples: number[]) {
  const stream = s2.basin('telemetry').stream('samples');
  const producer = new Producer(
    new BatchTransform({ lingerDurationMillis: 5 }),
    await stream.appendSession(),
  );

  for (const sample of samples) {
    void producer.submit(AppendRecord.string({ body: String(sample) }));
  }
}
