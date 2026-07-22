// Producer acked but never closed — unflushed batches and a pinned
// connection when the function exits.
import { AppendRecord, BatchTransform, Producer, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function publish(bodies: string[]) {
  const stream = s2.basin('telemetry').stream('samples');
  const producer = new Producer(
    new BatchTransform({ lingerDurationMillis: 5 }),
    await stream.appendSession(),
  );

  for (const body of bodies) {
    const ticket = await producer.submit(AppendRecord.string({ body }));
    await ticket.ack();
  }
}
