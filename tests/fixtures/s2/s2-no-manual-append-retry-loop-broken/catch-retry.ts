// Re-appends the same input in the catch: if the first append landed but
// the ack was lost, this writes the record twice.
import { AppendInput, AppendRecord, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function recordOrder(orderId: string) {
  const stream = s2.basin('shop').stream('orders');
  const input = AppendInput.create([AppendRecord.string({ body: orderId })]);

  try {
    await stream.append(input);
  } catch {
    // "just try once more"
    await stream.append(input);
  }
}
