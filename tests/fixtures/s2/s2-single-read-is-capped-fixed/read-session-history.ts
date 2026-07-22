// Full history via a read session: iterates batches until caught up
// (stop: { waitSecs: 0 }), however long the stream is.
import { S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function loadConversation(chatId: string) {
  const stream = s2.basin('chat-app').stream(`chat/${chatId}/history`);

  const session = await stream.readSession({
    start: { from: { seqNum: 0 }, clamp: true },
    stop: { waitSecs: 0 },
  });

  const messages: unknown[] = [];
  for await (const record of session) {
    messages.push(JSON.parse(String(record.body)));
  }
  return messages;
}
