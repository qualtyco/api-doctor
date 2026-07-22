// Adversarial: a bare unary read that *looks* like a capped full-stream
// read, but it starts at a runtime coordinate (the ack of a write) and
// deliberately fetches a couple of records — the documented read-back.
import { AppendInput, AppendRecord, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function writeAndVerify(body: string) {
  const stream = s2.basin('ledger').stream('entries');

  const ack = await stream.append(
    AppendInput.create([AppendRecord.string({ body })]),
  );

  const batch = await stream.read({
    start: { from: { seqNum: ack.start.seqNum } },
    stop: { limits: { count: 1 } },
  });

  return batch.records[0];
}
