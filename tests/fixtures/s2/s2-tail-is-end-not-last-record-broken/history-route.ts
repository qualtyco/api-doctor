// "Load history" session started at the tail with waitSecs: 0 — it returns
// the moment it is caught up, which at the tail is immediately, with nothing.
import { S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function GET(request: Request) {
  const chatId = new URL(request.url).searchParams.get('chatId')!;
  const stream = s2.basin('chat-app').stream(`chat/${chatId}/history`);

  const session = await stream.readSession({
    start: { from: { tailOffset: 0 }, clamp: true },
    stop: { waitSecs: 0 },
  });

  const messages: string[] = [];
  for await (const record of session) {
    messages.push(String(record.body));
  }
  return Response.json({ messages });
}
