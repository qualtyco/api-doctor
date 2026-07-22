// Sequential but still one independent batch per element — 200/sec rate
// limit applies and every element pays a full round trip.
import { AppendInput, AppendRecord, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function importHistory(rows: Array<{ id: string; payload: string }>) {
  const stream = s2.basin('crm').stream('contact-events');

  for (const row of rows) {
    await stream.append(
      AppendInput.create([AppendRecord.string({ body: row.payload })]),
    );
  }
}
