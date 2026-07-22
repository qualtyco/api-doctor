// The official pattern: close the session (and stream) in a finally block.
import { AppendInput, AppendRecord, S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function POST(request: Request) {
  const event = await request.json();
  const stream = s2.basin('analytics').stream('events');
  const session = await stream.appendSession();

  try {
    const ticket = await session.submit(
      AppendInput.create([AppendRecord.string({ body: JSON.stringify(event) })]),
    );
    const ack = await ticket.ack();
    return Response.json({ seqNum: ack.start.seqNum });
  } finally {
    await session.close();
    await stream.close();
  }
}
