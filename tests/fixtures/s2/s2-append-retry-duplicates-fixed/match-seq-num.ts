// Exactly-once for a single writer: even with "all", the matchSeqNum
// precondition makes a retried append fail instead of duplicating.
import { AppendInput, AppendRecord, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({
  ...S2Environment.parse(),
  accessToken: process.env.S2_ACCESS_TOKEN!,
  retry: { appendRetryPolicy: 'all' },
});

export async function writeCheckpoint(payload: string) {
  const stream = s2.basin('ledger').stream('checkpoints');
  const tail = await stream.checkTail();

  await stream.append(
    AppendInput.create([AppendRecord.string({ body: payload })]),
    { matchSeqNum: tail.tail.seqNum },
  );
}
