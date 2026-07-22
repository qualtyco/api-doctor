// Expects "the latest events" from a read at the tail — tailOffset: 0 is
// one past the last record, so this always returns an empty batch.
import { S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function getLatestEvents(sessionId: string) {
  const stream = s2.basin('chat-app').stream(`chat/${sessionId}/events`);

  const batch = await stream.read({
    start: { from: { tailOffset: 0 } },
  });

  return batch.records.map((r) => r.body);
}
