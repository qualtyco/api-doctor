// Classic bounded retry loop with swallowed errors and hand-rolled backoff,
// stacked on top of the SDK's own retries.
import { AppendInput, AppendRecord, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function recordPayment(paymentId: string) {
  const stream = s2.basin('billing').stream('payments');
  const input = AppendInput.create([AppendRecord.string({ body: paymentId })]);

  let attempts = 0;
  while (attempts < 3) {
    try {
      await stream.append(input);
      break;
    } catch {
      attempts += 1;
      await new Promise((resolve) => setTimeout(resolve, 250 * attempts));
    }
  }
}
