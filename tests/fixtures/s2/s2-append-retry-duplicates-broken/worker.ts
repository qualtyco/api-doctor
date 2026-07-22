// Queue worker — retry policy "all" configured via a shared config object,
// and the append reached through dynamic property access.
import { AppendInput, AppendRecord, S2 } from '@s2-dev/streamstore';

const clientConfig = {
  accessToken: process.env.S2_ACCESS_TOKEN!,
  retry: {
    maxAttempts: 5,
    appendRetryPolicy: 'all',
  },
};

const s2 = new S2(clientConfig);
const stream = s2.basin('jobs').stream('completed');

export async function recordCompletion(jobId: string, result: unknown) {
  await stream['append'](
    AppendInput.create([
      AppendRecord.string({ body: JSON.stringify({ jobId, result }) }),
    ]),
  );
}
