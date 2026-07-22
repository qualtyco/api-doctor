// Fetching the last 20 *existing* records: a non-zero tailOffset with
// clamp, bounded by waitSecs: 0 so it returns once caught up.
import { S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function getRecentEvents(sessionId: string) {
  const stream = s2.basin('chat-app').stream(`chat/${sessionId}/events`);

  const session = await stream.readSession({
    start: { from: { tailOffset: 20 }, clamp: true },
    stop: { waitSecs: 0 },
  });

  const events: string[] = [];
  for await (const record of session) {
    events.push(String(record.body));
  }
  return events;
}
