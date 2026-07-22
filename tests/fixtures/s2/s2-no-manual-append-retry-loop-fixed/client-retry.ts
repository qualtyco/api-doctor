// Retry is delegated to the client config — the SDK applies exponential
// backoff with jitter and only retries side-effect-free append failures.
import { AppendInput, AppendRecord, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({
  ...S2Environment.parse(),
  accessToken: process.env.S2_ACCESS_TOKEN!,
  retry: {
    maxAttempts: 5,
    minBaseDelayMillis: 100,
    appendRetryPolicy: 'noSideEffects',
  },
});

export async function recordOrder(orderId: string) {
  const stream = s2.basin('shop').stream('orders');
  await stream.append(
    AppendInput.create([AppendRecord.string({ body: orderId })]),
  );
}
