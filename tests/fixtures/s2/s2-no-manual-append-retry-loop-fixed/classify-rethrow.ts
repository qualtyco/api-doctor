// Adversarial: try/catch around an append looks like manual retry handling,
// but it *classifies* the error (S2's own fencing example) and rethrows
// anything unexpected — no append is retried.
import { AppendInput, AppendRecord, FencingTokenMismatchError, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function tryWrite(fencingToken: string, body: string) {
  const stream = s2.basin('ledger').stream('accounts');

  try {
    await stream.append(
      AppendInput.create([AppendRecord.string({ body })], { fencingToken }),
    );
    return true;
  } catch (error: unknown) {
    if (error instanceof FencingTokenMismatchError) {
      return false; // another writer owns the stream now
    }
    throw error;
  }
}
