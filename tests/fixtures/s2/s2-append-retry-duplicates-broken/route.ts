// app/api/events/route.ts — opts into retrying *all* failed appends, then
// does unary appends with no matchSeqNum: a lost ack means a duplicate event.
import { AppendInput, AppendRecord, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({
  ...S2Environment.parse(),
  accessToken: process.env.S2_ACCESS_TOKEN!,
  retry: { appendRetryPolicy: 'all' },
});

export async function POST(request: Request) {
  const event = await request.json();
  const stream = s2.basin('ledger').stream(`accounts/${event.accountId}`);

  const ack = await stream.append(
    AppendInput.create([AppendRecord.string({ body: JSON.stringify(event) })]),
  );

  return Response.json({ seqNum: ack.start.seqNum });
}
