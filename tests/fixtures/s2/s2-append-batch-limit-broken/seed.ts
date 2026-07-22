// Seed script building the oversized batch with new Array(N).fill().
import { AppendInput, AppendRecord, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });
const stream = s2.basin('demo').stream('seed-data');

export async function seed() {
  await stream.append(
    AppendInput.create(
      new Array(2000).fill(AppendRecord.string({ body: 'seed-record' })),
    ),
  );
}
