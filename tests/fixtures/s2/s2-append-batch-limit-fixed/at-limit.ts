// Adversarial: a statically-built bulk batch that *looks* oversized but sits
// exactly at the documented 1000-record maximum — legal in a single append.
import { AppendInput, AppendRecord, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function seedMaxBatch() {
  const stream = s2.basin('demo').stream('seed-data');

  await stream.append(
    AppendInput.create(
      Array.from({ length: 1000 }, (_, i) =>
        AppendRecord.string({ body: `seed-${i}` }),
      ),
    ),
  );
}
