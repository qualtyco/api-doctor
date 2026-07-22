// The SDK only retries append failures that could not have had a side
// effect, so a lost ack is surfaced as an error instead of duplicated.
import { AppendInput, AppendRecord, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({
  ...S2Environment.parse(),
  accessToken: process.env.S2_ACCESS_TOKEN!,
  retry: { appendRetryPolicy: 'noSideEffects' },
});

export async function recordEvent(body: string) {
  const stream = s2.basin('ledger').stream('events');
  const ack = await stream.append(
    AppendInput.create([AppendRecord.string({ body })]),
  );
  return ack.start.seqNum;
}
