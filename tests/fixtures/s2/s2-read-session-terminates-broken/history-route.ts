// Next.js route that "loads history" with no stop condition: once caught up
// the session waits for future records forever, so the request never returns.
import { S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function GET(request: Request) {
  const chatId = new URL(request.url).searchParams.get('chatId')!;
  const stream = s2.basin('chat-app').stream(`chat/${chatId}/history`);

  const session = await stream.readSession({
    start: { from: { seqNum: 0 }, clamp: true },
  });

  const messages: string[] = [];
  for await (const record of session) {
    messages.push(String(record.body));
  }

  return Response.json({ messages });
}
