// Treats one read from seqNum 0 as the entire stream — everything past the
// first 1000 records / 1 MiB is silently missing.
import { S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function loadConversation(chatId: string) {
  const stream = s2.basin('chat-app').stream(`chat/${chatId}/history`);

  const { records } = await stream.read({
    start: { from: { seqNum: 0 } },
  });

  // "the whole conversation"
  return records.map((r) => JSON.parse(String(r.body)));
}
