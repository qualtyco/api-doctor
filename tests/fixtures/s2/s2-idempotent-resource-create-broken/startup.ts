// Startup provisioning that works exactly once: the second boot (or a
// concurrent instance) gets HTTP 409 and crashes.
import { S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function ensureStreams() {
  const basin = s2.basin('chat-app');

  await basin.streams.create({ stream: 'lobby' });
  await basin.streams.create({ stream: 'announcements' });
}
