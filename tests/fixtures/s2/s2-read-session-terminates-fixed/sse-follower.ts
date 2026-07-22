// Adversarial: an unbounded session inside a route handler looks like the
// hang, but this is an intentional SSE follower wired to the request's
// abort signal — it ends when the client disconnects.
import { S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function GET(request: Request) {
  const chatId = new URL(request.url).searchParams.get('chatId')!;
  const stream = s2.basin('chat-app').stream(`chat/${chatId}/events`);

  const session = await stream.readSession(
    {
      start: { from: { tailOffset: 0 }, clamp: true },
    },
    { signal: request.signal },
  );

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      for await (const record of session) {
        controller.enqueue(encoder.encode(`data: ${record.body}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}
