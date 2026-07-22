// Adversarial: appendRetryPolicy "all" looks like the duplicate-records bug,
// but the writer is a Producer — it maintains matchSeqNum across batches, so
// a retried batch is rejected as a precondition mismatch, never duplicated.
// (This is S2's own documented Producer configuration.)
import { AppendRecord, BatchTransform, Producer, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({
  ...S2Environment.parse(),
  accessToken: process.env.S2_ACCESS_TOKEN!,
  retry: {
    // Producer can safely retry all batches because it maintains matchSeqNum.
    appendRetryPolicy: 'all',
  },
});

export async function publishEvents(events: string[]) {
  const stream = s2.basin('ledger').stream('events');
  const producer = new Producer(
    new BatchTransform({ lingerDurationMillis: 25 }),
    await stream.appendSession(),
  );

  try {
    const tickets = [];
    for (const body of events) {
      tickets.push(await producer.submit(AppendRecord.string({ body })));
    }
    await Promise.all(tickets.map((t) => t.ack()));
  } finally {
    await producer.close();
    await stream.close();
  }
}
