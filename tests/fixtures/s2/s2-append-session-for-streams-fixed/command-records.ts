// Adversarial: fence and trim look like odd "data" appends, but they are
// command records — first-class control operations submitted through the
// append path, correctly written as one-off unary appends.
import { AppendInput, AppendRecord, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function rotateWriter(fencingToken: string, lastSeqNum: number) {
  const stream = s2.basin('ledger').stream('accounts');

  await stream.append(AppendInput.create([AppendRecord.fence(fencingToken)]));
  await stream.append(AppendInput.create([AppendRecord.trim(lastSeqNum + 1)]));
}
